// Lightbox for gallery.html (hand-written, not generated). Without JavaScript the links open the image directly.
(() => {
  const links = [...document.querySelectorAll('.grid a')];
  if (!links.length) return;
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.innerHTML = '<button class="close" aria-label="Close">×</button>' +
    '<button class="prev" aria-label="Previous">‹</button><img alt=""><p></p>' +
    '<button class="next" aria-label="Next">›</button>';
  document.body.appendChild(box);
  const img = box.querySelector('img'), cap = box.querySelector('p');
  let i = 0;
  const show = n => {
    i = (n + links.length) % links.length;
    img.src = links[i].href;
    img.alt = cap.textContent = links[i].dataset.caption;
    box.classList.add('open');
  };
  const close = () => box.classList.remove('open');
  links.forEach((a, n) => a.addEventListener('click', e => { e.preventDefault(); show(n); }));
  box.querySelector('.close').onclick = close;
  box.querySelector('.prev').onclick = e => { e.stopPropagation(); show(i - 1); };
  box.querySelector('.next').onclick = e => { e.stopPropagation(); show(i + 1); };
  box.addEventListener('click', e => { if (e.target === box) close(); });
  document.addEventListener('keydown', e => {
    if (!box.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(i - 1);
    if (e.key === 'ArrowRight') show(i + 1);
  });
})();
