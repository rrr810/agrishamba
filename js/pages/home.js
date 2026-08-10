/** home.js — landing page: animated stats + featured listings. */
import { products } from '../api.js';
import { productCard, skeletonGrid, errorState, qs, formatNumber } from '../ui.js';
import { demoStats } from '../../data/demo-data.js';

function renderStats() {
  const grid = qs('#statsGrid');
  if (!grid) return;
  grid.innerHTML = demoStats.map((s) => `
    <div><div class="num" data-target="${s.value}" data-suffix="${s.suffix}">0</div>
    <div class="lbl">${s.label}</div></div>`).join('');

  const nums = grid.querySelectorAll('.num');
  const animated = new Set();

  const animate = (el) => {
    if (animated.has(el)) return;
    animated.add(el);
    const target = Number(el.dataset.target);
    const suffix = el.dataset.suffix || '';
    const start = performance.now();
    const dur = 1000;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      el.textContent = formatNumber(Math.round(target * (1 - Math.pow(1 - p, 3)))) + suffix;
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = formatNumber(target) + suffix;
    };
    requestAnimationFrame(tick);
  };

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          animate(e.target);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });
    nums.forEach((n) => io.observe(n));
  } else {
    nums.forEach(animate);
  }

  // Safety fallback after 1s
  setTimeout(() => {
    nums.forEach(animate);
  }, 1000);
}

async function renderFeatured() {
  const mount = qs('#featuredProducts');
  if (!mount) return;
  mount.innerHTML = skeletonGrid(4);
  const { data, error } = await products.list({ perPage: 4, sort: 'rating' });
  if (error) { mount.innerHTML = errorState(error.message); return; }
  mount.innerHTML = data.rows.map(productCard).join('');
}

renderStats();
renderFeatured();