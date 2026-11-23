// The dot on the line names the last section whose top has reached it.
export function label() {
  const marker = document.querySelector('.marker'), out = document.getElementById('mlabel');
  if (!marker || !out) return;
  const y = marker.getBoundingClientRect().top;
  let cur = 'Scroll';
  for (const s of document.querySelectorAll('[data-label]')) if (s.getBoundingClientRect().top <= y + 2) cur = s.dataset.label;
  if (out.textContent !== cur) out.textContent = cur;
}
export function watchMarker() {
  let queued = false;
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; label(); }); } }, { passive: true });
  addEventListener('resize', label);
  label();
}
