import QRCode from 'qrcode';
import { connect, roomFromUrl, usingFirebase } from './sync.js';
import { scenes, START } from './story.js';

const room = roomFromUrl();
const store = connect(room);
const $ = (id) => document.getElementById(id);

const joinUrl = new URL(`play.html?room=${encodeURIComponent(room)}`, location.href).href;
$('joinUrl').textContent = usingFirebase ? joinUrl : `${joinUrl} (local test mode: open in another tab)`;
QRCode.toCanvas($('qr'), joinUrl, { width: 260, margin: 1 });

// The screen drives the film locally so cuts never wait on the network.
// Firebase only carries the current scene out to the phones and their
// responses back. Every clip gets its own preloaded <video>, so a cut is
// just swapping which element is visible.
const videos = new Map();
for (const scene of Object.values(scenes)) {
  for (const src of [scene.clip, scene.loopClip]) {
    if (!src || videos.has(src)) continue;
    const v = document.createElement('video');
    v.src = src;
    v.preload = 'auto';
    v.playsInline = true;
    $('stage').appendChild(v);
    videos.set(src, v);
  }
}

let state = {};
let current = null;
let active = null;
let waitTimer = null;

waitForClips();

store.subscribe((next) => {
  state = next;
  $('playerCount').textContent = playerCount();
  if (current && scenes[current].interaction && state.scene?.phase === 'interact') checkInteraction();
});

$('startBtn').onclick = async () => {
  await store.reset();
  goTo(START);
};

$('resetBtn').onclick = reset;
document.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') reset();
});

function playerCount() {
  return Object.keys(state.players || {}).length;
}

function goTo(id) {
  current = id;
  clearTimeout(waitTimer);
  const scene = scenes[id];
  $('lobby').classList.add('hidden');
  $('hud').classList.add('hidden');
  $('resetBtn').classList.remove('hidden');
  show(scene.clip, false).then(() => {
    if (current !== id) return;
    if (scene.interaction) {
      openInteraction(scene);
    } else {
      advance(scene);
    }
  });
  store.setScene(id);
}

function openInteraction(scene) {
  // Cut straight into the loop; if there is none, hold the last frame.
  if (scene.loopClip) show(scene.loopClip, true);
  store.setScene(current, 'interact');
  $('prompt').textContent = scene.interaction.prompt;
  $('hud').classList.remove('hidden');
  waitTimer = setTimeout(() => advance(scene), scene.interaction.timeoutMs);
  checkInteraction();
}

function checkInteraction() {
  const scene = scenes[current];
  const done = Object.keys(state.responses?.[current] || {}).length;
  const needed = Math.max(1, Math.ceil(playerCount() * scene.interaction.threshold));
  $('progress').style.width = `${Math.min(100, (done / needed) * 100)}%`;
  $('progressText').textContent = `${done} / ${needed}`;
  if (done >= needed) {
    clearTimeout(waitTimer);
    waitTimer = setTimeout(() => advance(scene), 600);
  }
}

function advance(scene) {
  clearTimeout(waitTimer);
  $('hud').classList.add('hidden');
  if (scene.next) goTo(scene.next);
}

// Starts a clip from the top and makes it the visible one. The new clip is
// layered on top and only revealed once it is playing, so the previous
// clip's last frame covers the cut and there is never a black flash. Resolves when a non-looping clip ends.
let layer = 0;
function show(src, loop) {
  const v = videos.get(src);
  const prev = active;
  active = v;
  v.loop = loop;
  v.currentTime = 0;
  return new Promise((resolve) => {
    // A clip that failed to load is skipped rather than stalling the film.
    if (v.error) return resolve();
    v.onended = loop ? null : () => resolve();
    v.onerror = () => resolve();
    if (v === prev) {
      v.play().catch(() => {});
      return;
    }
    v.style.zIndex = ++layer;
    const reveal = () => {
      v.classList.add('active');
      if (prev) {
        prev.classList.remove('active');
        prev.pause();
      }
    };
    onFirstFrame(v, reveal);
    v.play().catch(() => {
      // Autoplay with sound blocked: retry muted rather than stall the film.
      v.muted = true;
      v.play().catch(() => {});
    });
  });
}

// Calls fn once the clip is actually playing, i.e. it has a decoded frame
// to show, so swapping it in never exposes an empty (black) element.
function onFirstFrame(v, fn) {
  v.addEventListener('playing', fn, { once: true });
}

async function reset() {
  clearTimeout(waitTimer);
  current = null;
  for (const v of videos.values()) {
    v.pause();
    v.classList.remove('active');
    v.currentTime = 0;
  }
  active = null;
  $('hud').classList.add('hidden');
  $('resetBtn').classList.add('hidden');
  $('lobby').classList.remove('hidden');
  await store.reset();
}

// Begin unlocks once every clip has buffered enough to play through.
function waitForClips() {
  const all = [...videos.values()];
  let ready = 0;
  const update = () => {
    $('loading').textContent = ready < all.length ? `Loading film… ${ready}/${all.length}` : '';
    $('startBtn').disabled = ready < all.length;
  };
  for (const v of all) {
    const done = () => { ready++; update(); };
    if (v.readyState >= 4) done();
    else {
      v.addEventListener('canplaythrough', done, { once: true });
      v.addEventListener('error', done, { once: true });
    }
  }
  update();
}
