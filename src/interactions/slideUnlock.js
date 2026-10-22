// iPhone-style slide to unlock, drawn as a seat-belt buckle.
export function slideUnlock(config, done) {
  const el = document.createElement('div');
  el.className = 'slide-unlock';
  el.innerHTML = `
    <p class="prompt"></p>
    <div class="track">
      <span class="label"></span>
      <div class="knob" aria-label="buckle"><div class="buckle"></div></div>
    </div>`;
  el.querySelector('.prompt').textContent = config.prompt;
  el.querySelector('.label').textContent = config.label || 'slide to unlock';

  const track = el.querySelector('.track');
  const knob = el.querySelector('.knob');
  let startX = 0;
  let dragging = false;
  let finished = false;

  const max = () => track.clientWidth - knob.offsetWidth - 8;

  knob.addEventListener('pointerdown', (e) => {
    if (finished) return;
    dragging = true;
    startX = e.clientX - knob.offsetLeft + 4;
    knob.setPointerCapture(e.pointerId);
    knob.style.transition = 'none';
  });

  knob.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const x = Math.min(max(), Math.max(0, e.clientX - startX));
    knob.style.transform = `translateX(${x}px)`;
    track.style.setProperty('--fill', `${(x / max()) * 100}%`);
  });

  knob.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    const x = e.clientX - startX;
    knob.style.transition = '';
    if (x >= max() * 0.9) {
      finished = true;
      knob.style.transform = `translateX(${max()}px)`;
      el.classList.add('unlocked');
      el.querySelector('.label').textContent = 'unlocked';
      done(true);
    } else {
      knob.style.transform = 'translateX(0)';
      track.style.setProperty('--fill', '0%');
    }
  });

  return el;
}
