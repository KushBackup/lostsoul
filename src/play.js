import { connect, playerId, roomFromUrl } from './sync.js';
import { scenes } from './story.js';
import { interactions } from './interactions/index.js';

const app = document.getElementById('app');
const store = connect(roomFromUrl());
const me = playerId();

store.join(me);

let shown = null;

store.subscribe((state) => {
  const scene = state.scene;
  const key = scene ? `${scene.id}:${scene.phase}` : 'lobby';
  if (key === shown) return;
  shown = key;

  const def = scene && scenes[scene.id];
  const answered = scene && state.responses?.[scene.id]?.[me];
  if (def?.interaction && scene.phase === 'interact' && !answered) {
    const render = interactions[def.interaction.type];
    app.replaceChildren(render(def.interaction, (value) => {
      store.respond(scene.id, me, value ?? true);
      navigator.vibrate?.(80);
    }));
  } else {
    app.replaceChildren(waiting(scene ? 'Watch the screen' : 'Connected. Waiting for the story to begin'));
  }
});

function waiting(text) {
  const el = document.createElement('div');
  el.className = 'waiting';
  el.innerHTML = '<div class="pulse"></div><p></p>';
  el.querySelector('p').textContent = text;
  return el;
}
