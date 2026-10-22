// Downloads the rendered clips listed in clips.json into public/clips/,
// trims any black frames off their start and end, and encodes every clip
// with identical settings (1080p, 24fps, VP9 + Opus in fragmented MP4,
// keyframe every 0.5s) so the screen's SeamlessPlayer can chain them into
// one stream.
// Needs ffmpeg on PATH. Usage: node scripts/prepare-clips.mjs
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

  const hasAudio = execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', raw,
  ]).toString().trim() !== '';
  execFileSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-ss', start.toFixed(3), '-to', end.toFixed(3), '-i', raw,
    // Clips without sound get silence so every segment has the same tracks.
    ...(hasAudio ? [] : ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo']),
    '-map', '0:v:0', '-map', hasAudio ? '0:a:0' : '1:a:0',
    '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=24,format=yuv420p',
    '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '30', '-deadline', 'good', '-cpu-used', '4', '-row-mt', '1',
    '-g', '12', '-keyint_min', '12',
    '-af', 'apad', '-c:a', 'libopus', '-b:a', '160k', '-ar', '48000', '-ac', '2',
    '-shortest',
    '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof',
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
