// Downloads the rendered clips listed in clips.json into public/clips/ and
// trims any black frames off their start and end, so cuts between clips
// don't flash black. Needs ffmpeg on PATH. Usage: node scripts/prepare-clips.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const clips = JSON.parse(readFileSync('clips.json', 'utf8'));
const outDir = 'public/clips';
const tmpDir = join(outDir, '.raw');
mkdirSync(tmpDir, { recursive: true });

// Frames count as black when 98% of pixels are under 10% brightness.
const BLACK = 'blackdetect=d=0.02:pix_th=0.10:pic_th=0.98';
const EDGE = 0.1; // a black run within this many seconds of an edge is trimmed

for (const [name, url] of Object.entries(clips)) {
  const raw = join(tmpDir, `${name}.mp4`);
  if (!existsSync(raw)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${name}: download failed (${res.status})`);
    writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  }

  const duration = Number(execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', raw,
  ]).toString());

  const runs = [...blackRuns(raw)];

  let start = 0;
  let end = duration;
  for (const r of runs) {
    if (r.start <= EDGE) start = Math.max(start, r.end);
    if (r.end >= duration - EDGE) end = Math.min(end, r.start);
  }
  if (end - start < 0.5) throw new Error(`${name}: clip is almost entirely black`);

  execFileSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-ss', start.toFixed(3), '-to', end.toFixed(3), '-i', raw,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart',
    join(outDir, `${name}.mp4`),
  ]);
  const runText = runs.map((r) => `${r.start.toFixed(2)}-${r.end.toFixed(2)}`).join(', ') || 'none';
  console.log(`${name}: ${duration.toFixed(2)}s, black runs [${runText}] -> kept ${start.toFixed(2)}-${end.toFixed(2)}s`);
}

rmSync(tmpDir, { recursive: true, force: true });

function* blackRuns(file) {
  // blackdetect reports on stderr, so fold it into stdout.
  const out = execFileSync('sh', ['-c', `ffmpeg -hide_banner -i "${file}" -vf ${BLACK} -an -f null - 2>&1`]).toString();
  for (const m of out.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)) {
    yield { start: Number(m[1]), end: Number(m[2]) };
  }
}
