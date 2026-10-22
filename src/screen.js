import QRCode from 'qrcode';
import { connect, roomFromUrl, usingFirebase } from './sync.js';
import { scenes, START } from './story.js';

const room = roomFromUrl();
const store = connect(room);
const $ = (id) => document.getElementById(id);
const video = $('video');

const joinUrl = new URL(`play.html?room=${encodeURIComponent(room)}`, location.href).href;
$('joinUrl').textContent = usingFirebase ? joinUrl : `${joinUrl} (local test mode: open in another tab)`;
QRCode.toCanvas($('qr'), joinUrl, { width: 260, margin: 1 });

let state = {};
let currentScene = null;
let waitTimer = null;

store.subscribe((next) => {
  state = next;
  $('playerCount').textContent = playerCount();
  if (state.scene?.id !== currentScene) {
    currentScene = state.scene?.id ?? null;
    if (currentScene) playScene(currentScene);
  }
  if (state.scene?.phase === 'interact') checkInteraction();
});

$('startBtn').onclick = async () => {
  await store.reset();
  // Browsers only allow sound after a click, so unlock audio here.
  video.muted = false;
  store.setScene(START);
};

function playerCount() {
  return Object.keys(state.players || {}).length;
}

function playScene(id) {
  const scene = scenes[id];
  $('lobby').classList.add('hidden');
  $('hud').classList.add('hidden');
  clearTimeout(waitTimer);
  playClip(scene.clip, false).then(() => {
    if (scene.interaction) {
      store.setScene(id, 'interact');
      openInteraction(scene);
    } else {
      advance(scene);
    }
  });
}

function openInteraction(scene) {
  if (scene.loopClip) playClip(scene.loopClip, true);
  $('prompt').textContent = scene.interaction.prompt;
  $('hud').classList.remove('hidden');
  waitTimer = setTimeout(() => advance(scene), scene.interaction.timeoutMs);
  checkInteraction();
}

function checkInteraction() {
  const scene = scenes[currentScene];
  if (!scene?.interaction) return;
  const done = Object.keys(state.responses?.[currentScene] || {}).length;
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
  if (scene.next) {
    store.setScene(scene.next);
  } else {
    $('hud').classList.add('hidden');
  }
}

// Resolves when the clip ends. Missing clips show a title card instead so
// the flow can be tested before the footage exists.
function playClip(src, loop) {
  return new Promise((resolve) => {
    video.loop = loop;
    video.src = src;
    video.onended = () => resolve();
    video.onerror = () => {
      video.removeAttribute('src');
      showPlaceholder(src);
      if (!loop) setTimeout(resolve, 3000);
    };
    video.play().catch(() => {});
  });
}

function showPlaceholder(src) {
  let card = document.getElementById('placeholder');
  if (!card) {
    card = document.createElement('div');
    card.id = 'placeholder';
    card.className = 'overlay';
    document.body.appendChild(card);
  }
  card.textContent = `[ ${src.split('/').pop()} ]`;
  card.classList.remove('hidden');
  setTimeout(() => card.classList.add('hidden'), 2900);
}
