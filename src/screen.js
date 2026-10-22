import QRCode from 'qrcode';
import { connect, roomFromUrl, usingFirebase } from './sync.js';
import { scenes, START } from './story.js';
import { SeamlessPlayer, isSupported } from './player.js';

const room = roomFromUrl();
const store = connect(room);
const $ = (id) => document.getElementById(id);

const joinUrl = new URL(`play.html?room=${encodeURIComponent(room)}`, location.href).href;
$('joinUrl').textContent = usingFirebase ? joinUrl : `${joinUrl} (local test mode: open in another tab)`;
QRCode.toCanvas($('qr'), joinUrl, { width: 260, margin: 1 });

// The screen drives the film locally so cuts never wait on the network.
// Firebase only carries the current scene out to the phones and their
// responses back. All clips play through one SeamlessPlayer stream, so the
// film is a single continuous video with no cuts between clips.
const player = new SeamlessPlayer($('video'));
const loopOf = (scene) => scene.loopClip ?? scene.clip;

let state = {};
let current = null;
let lastEntry = null;
let resolved = false;
let openFor = null;
let waitTimer = null;
let frame = null;

loadFilm();

store.subscribe((next) => {
  state = next;
  $('playerCount').textContent = playerCount();
  if (current && scenes[current].interaction && state.scene?.phase === 'interact') checkInteraction();
});

$('startBtn').onclick = async () => {
  await store.reset();
  start();
};

$('resetBtn').onclick = reset;
document.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') reset();
});

function playerCount() {
  return Object.keys(state.players || {}).length;
}

async function loadFilm() {
  if (!isSupported()) {
    $('loading').textContent = 'This browser cannot play the film. Use Chrome, Edge, Firefox or Safari on a computer.';
    return;
  }
  const urls = new Set();
  for (const scene of Object.values(scenes)) {
    urls.add(scene.clip);
    if (scene.interaction) urls.add(loopOf(scene));
  }
  try {
    await player.load([...urls], (n, total) => {
      $('loading').textContent = `Loading film… ${n}/${total}`;
    });
    $('loading').textContent = '';
    $('startBtn').disabled = false;
  } catch (err) {
    $('loading').textContent = `Could not load the film (${err.message}).`;
  }
}

function start() {
  $('lobby').classList.add('hidden');
  $('hud').classList.add('hidden');
  $('resetBtn').classList.remove('hidden');
  current = null;
  lastEntry = null;
  openFor = null;
  player.open();
  queueFrom(START);
  player.video.play().catch(() => {
    // Autoplay with sound blocked: play muted rather than stall the film.
    player.video.muted = true;
    player.video.play();
  });
  watch();
}

// Appends scene `id` and everything after it that doesn't depend on the
// audience. An interaction scene is followed by its loop clip, which keeps
// repeating until the interaction resolves. With `cutAt`, the stream jumps
// to this scene at that time instead of after what's already queued.
function queueFrom(id, cutAt) {
  const scene = scenes[id];
  const tag = { scene: id, kind: 'clip' };
  const first = cutAt == null
    ? player.append(scene.clip, tag)
    : player.cutTo(cutAt, scene.clip, tag);
  if (scene.interaction) {
    resolved = false;
    player.append(loopOf(scene), { scene: id, kind: 'loop' });
  } else if (scene.next) {
    first.then(() => queueFrom(scene.next));
  } else {
    player.finish();
  }
}

// Follows the playhead and reacts as it crosses into each queued clip.
function watch() {
  cancelAnimationFrame(frame);
  const tick = () => {
    const entry = player.entryAt();
    if (entry && entry !== lastEntry) {
      lastEntry = entry;
      enter(entry);
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}

function enter({ tag, url }) {
  const scene = scenes[tag.scene];
  if (tag.kind === 'clip') {
    current = tag.scene;
    $('hud').classList.add('hidden');
    store.setScene(current);
    return;
  }
  // A loop pass: the first one opens the interaction; each pass queues the
  // next so the loop never runs dry.
  if (openFor !== current) openInteraction(scene);
  if (!resolved) player.append(url, tag);
}

function openInteraction(scene) {
  openFor = current;
  store.setScene(current, 'interact');
  $('prompt').textContent = scene.interaction.prompt;
  $('hud').classList.remove('hidden');
  clearTimeout(waitTimer);
  waitTimer = setTimeout(() => resolveInteraction(scene), scene.interaction.timeoutMs);
  checkInteraction();
}

function checkInteraction() {
  const scene = scenes[current];
  if (resolved) return;
  const done = Object.keys(state.responses?.[current] || {}).length;
  const needed = Math.max(1, Math.ceil(playerCount() * scene.interaction.threshold));
  $('progress').style.width = `${Math.min(100, (done / needed) * 100)}%`;
  $('progressText').textContent = `${done} / ${needed}`;
  if (done >= needed) resolveInteraction(scene);
}

// Leaves the loop: the next scene is spliced in a moment ahead of the
// playhead, so the change lands mid-stream without any pause.
function resolveInteraction(scene) {
  if (resolved) return;
  resolved = true;
  clearTimeout(waitTimer);
  setTimeout(() => $('hud').classList.add('hidden'), 600);
  if (scene.next) {
    queueFrom(scene.next, player.video.currentTime + 0.5);
  } else {
    player.finish();
  }
}

async function reset() {
  clearTimeout(waitTimer);
  cancelAnimationFrame(frame);
  current = null;
  lastEntry = null;
  openFor = null;
  player.stop();
  $('hud').classList.add('hidden');
  $('resetBtn').classList.add('hidden');
  $('lobby').classList.remove('hidden');
  await store.reset();
}
