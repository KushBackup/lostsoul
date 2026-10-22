// A gapless player: every clip is appended to one Media Source buffer, so
// the browser sees a single continuous stream and there is no cut between
// clips at all. Clips are fragmented MP4 (VP9 + Opus) encoded with identical
// settings by scripts/prepare-clips.mjs, so their segments can be chained.
//
// The buffer runs in "sequence" mode: each appended clip starts exactly where
// the previous one ended. The timeline records where each clip landed so the
// caller can react as playback crosses into it.

export const MIME = 'video/mp4; codecs="vp09.00.40.08,opus"';

export function isSupported() {
  return 'MediaSource' in window && MediaSource.isTypeSupported(MIME);
}

export class SeamlessPlayer {
  constructor(video) {
    this.video = video;
    this.data = new Map();
    this.timeline = [];
    this.queue = Promise.resolve();
  }

  // Downloads every clip up front. onProgress(loaded, total) counts clips.
  async load(urls, onProgress) {
    let loaded = 0;
    await Promise.all(urls.map(async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      this.data.set(url, await res.arrayBuffer());
      onProgress?.(++loaded, urls.length);
    }));
  }

  // Opens a fresh stream. Call before the first append, and again to restart.
  open() {
    this.timeline = [];
    this.ended = false;
    this.source = new MediaSource();
    this.video.src = URL.createObjectURL(this.source);
    this.queue = new Promise((resolve) => {
      this.source.addEventListener('sourceopen', () => {
        URL.revokeObjectURL(this.video.src);
        this.buffer = this.source.addSourceBuffer(MIME);
        this.buffer.mode = 'sequence';
        resolve();
      }, { once: true });
    });
  }

  // Adds a clip to the end of the stream. Resolves with its timeline entry.
  append(url, tag) {
    return this.enqueue(() => this.appendNow(url, tag));
  }

  // Drops everything queued after `at` (seconds on the stream clock) and
  // continues with `url` from there. Used to leave a loop early.
  cutTo(at, url, tag) {
    return this.enqueue(async () => {
      const end = this.bufferedEnd;
      if (at < end) {
        await this.update(() => this.buffer.remove(at, end));
        this.timeline = this.timeline
          .filter((e) => e.start < at)
          .map((e) => (e.end > at ? { ...e, end: at } : e));
        // In sequence mode this sets where the next appended clip starts.
        this.buffer.timestampOffset = at;
      }
      return this.appendNow(url, tag);
    });
  }

  async appendNow(url, tag) {
    const start = this.bufferedEnd;
    await this.update(() => this.buffer.appendBuffer(this.data.get(url)));
    const ranges = this.buffer.buffered;
    const end = ranges.length ? ranges.end(ranges.length - 1) : start;
    const entry = { url, tag, start, end };
    this.timeline.push(entry);
    return entry;
  }

  // Marks the stream complete so the video fires 'ended' after the last clip.
  finish() {
    return this.enqueue(async () => {
      if (this.source.readyState === 'open') this.source.endOfStream();
      this.ended = true;
    });
  }

  // The timeline entry under the playhead.
  entryAt(t = this.video.currentTime) {
    return this.timeline.find((e) => t >= e.start && t < e.end) ?? null;
  }

  // Time on the stream clock at which buffered content runs out.
  get bufferedEnd() {
    return this.timeline.length ? this.timeline[this.timeline.length - 1].end : 0;
  }

  stop() {
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load();
    this.source = null;
    this.buffer = null;
    this.timeline = [];
  }

  enqueue(fn) {
    const run = this.queue.then(fn);
    this.queue = run.catch(() => {});
    return run;
  }

  update(op) {
    return new Promise((resolve, reject) => {
      this.buffer.addEventListener('updateend', resolve, { once: true });
      this.buffer.addEventListener('error', reject, { once: true });
      op();
    });
  }
}
