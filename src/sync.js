// Room state shared between the big screen and every phone.
// Uses Firebase Realtime Database when configured, otherwise a same-browser
// fallback (BroadcastChannel) so the flow can be tested in two tabs.
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update, onDisconnect, serverTimestamp } from 'firebase/database';

const env = import.meta.env;
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const usingFirebase = Boolean(firebaseConfig.databaseURL);

export function roomFromUrl() {
  return new URLSearchParams(location.search).get('room') || 'main';
}

export function playerId() {
  let id = localStorage.getItem('lostsoul-player');
  if (!id) {
    id = Math.random().toString(36).slice(2, 10);
    localStorage.setItem('lostsoul-player', id);
  }
  return id;
}

export function connect(room) {
  return usingFirebase ? firebaseRoom(room) : localRoom(room);
}

function firebaseRoom(room) {
  const db = getDatabase(initializeApp(firebaseConfig));
  const root = `rooms/${room}`;
  return {
    subscribe(cb) {
      return onValue(ref(db, root), (snap) => cb(snap.val() || {}));
    },
    setScene(sceneId, phase = 'clip') {
      return update(ref(db, root), { scene: { id: sceneId, phase, at: serverTimestamp() } });
    },
    reset() {
      return update(ref(db, root), { responses: null, scene: null });
    },
    join(id) {
      const me = ref(db, `${root}/players/${id}`);
      onDisconnect(me).remove();
      return set(me, { joinedAt: serverTimestamp() });
    },
    respond(sceneId, id, value) {
      return set(ref(db, `${root}/responses/${sceneId}/${id}`), value);
    },
  };
}

function localRoom(room) {
  const key = `lostsoul-room-${room}`;
  const channel = new BroadcastChannel(key);
  const listeners = new Set();
  const read = () => JSON.parse(localStorage.getItem(key) || '{}');
  const emit = () => listeners.forEach((cb) => cb(read()));
  const write = (fn) => {
    const state = read();
    fn(state);
    localStorage.setItem(key, JSON.stringify(state));
    channel.postMessage('changed');
    emit();
  };
  channel.onmessage = emit;
  return {
    subscribe(cb) {
      listeners.add(cb);
      cb(read());
      return () => listeners.delete(cb);
    },
    setScene(sceneId, phase = 'clip') {
      write((s) => { s.scene = { id: sceneId, phase, at: Date.now() }; });
    },
    reset() {
      write((s) => { s.responses = {}; s.scene = null; });
    },
    join(id) {
      write((s) => { (s.players ||= {})[id] = { joinedAt: Date.now() }; });
    },
    respond(sceneId, id, value) {
      write((s) => { ((s.responses ||= {})[sceneId] ||= {})[id] = value; });
    },
  };
}
