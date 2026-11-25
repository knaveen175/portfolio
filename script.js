// Opening curtain: drop it once the animation has played
const intro = document.getElementById('intro');
if (intro) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(() => intro.remove(), reduced ? 0 : 2400);
}

// Theme toggle (dark / light)
const themeToggle = document.getElementById('themeToggle');
const rootEl = document.documentElement;

function applyTheme(theme) {
  rootEl.dataset.theme = theme;
  const isLight = theme === 'light';
  themeToggle.setAttribute('aria-pressed', String(isLight));
  themeToggle.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', isLight ? '#f4f5f8' : '#0c0c0d');
}

applyTheme(rootEl.dataset.theme === 'light' ? 'light' : 'dark');

themeToggle.addEventListener('click', () => {
  const next = rootEl.dataset.theme === 'light' ? 'dark' : 'light';
  applyTheme(next);
  try { localStorage.setItem('nk-theme', next); } catch (e) {}
});

// Scroll progress bar
const progressBar = document.getElementById('progressBar');
const nav = document.getElementById('nav');
const sections = [...document.querySelectorAll('main section[id]')];
const navLinks = [...document.querySelectorAll('.nav-links a')];

function onScroll() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const pct = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
  progressBar.style.width = pct + '%';
  nav.classList.toggle('scrolled', window.scrollY > 24);

  // active section link
  const pos = window.scrollY + window.innerHeight * 0.35;
  let current = '';
  for (const s of sections) {
    if (s.offsetTop <= pos) current = s.id;
  }
  for (const a of navLinks) {
    a.classList.toggle('active', a.getAttribute('href') === '#' + current);
  }
}

window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);
onScroll();

// Mobile menu
const menuBtn = document.getElementById('menuBtn');
const menu = document.getElementById('navLinks');

menuBtn.addEventListener('click', () => {
  const open = menu.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
});

menu.addEventListener('click', (e) => {
  if (e.target.closest('a')) {
    menu.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
  }
});

// Reveal on scroll
const revealTargets = document.querySelectorAll('.reveal, .skill');

if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        // stagger siblings a little
        const delay = Number(el.dataset.delay || 0);
        el.style.transitionDelay = delay + 'ms';
        el.classList.add('in');
        io.unobserve(el);
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.12 }
  );

  document.querySelectorAll('.skill-grid .skill').forEach((el, i) => {
    el.dataset.delay = String(i * 60);
  });

  revealTargets.forEach((el) => io.observe(el));
} else {
  revealTargets.forEach((el) => el.classList.add('in'));
}

// Footer year
document.getElementById('year').textContent = new Date().getFullYear();

/* ---------- sky: glowing balls converging on the cursor ---------- */
(function sky() {
  const canvas = document.getElementById('sky');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const DARK = ['#9db8ff', '#7f6bff', '#4fe0ff', '#c2b4ff', '#5ec8ff'];
  const LIGHT = ['#2f55cc', '#6047d6', '#0d7fae', '#7a5cd6', '#1f74c4'];

  let W = 0, H = 0, dpr = 1, raf = 0, last = 0;
  let balls = [];
  let stars = [];
  const trail = [];
  const pointer = { x: 0, y: 0, active: false, last: 0 };

  const palette = () => (document.documentElement.dataset.theme === 'light' ? LIGHT : DARK);

  function hexA(hex, a) {
    const v = hex.replace('#', '');
    const n = v.length === 3 ? v.split('').map((c) => c + c).join('') : v;
    const num = parseInt(n, 16);
    return 'rgba(' + ((num >> 16) & 255) + ', ' + ((num >> 8) & 255) + ', ' + (num & 255) + ', ' + a + ')';
  }

  // pre-render each ball once so the frame loop is just drawImage
  function makeSprite(color, r) {
    const pad = Math.max(10, r * 1.9);
    const size = (r + pad) * 2;
    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil(size * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const cx = size / 2, cy = size / 2;

    const halo = g.createRadialGradient(cx, cy, r * 0.2, cx, cy, r + pad);
    halo.addColorStop(0, hexA(color, 0.5));
    halo.addColorStop(0.35, hexA(color, 0.2));
    halo.addColorStop(1, hexA(color, 0));
    g.fillStyle = halo;
    g.beginPath(); g.arc(cx, cy, r + pad, 0, Math.PI * 2); g.fill();

    const core = g.createRadialGradient(cx - r * 0.32, cy - r * 0.36, r * 0.08, cx, cy, r);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.4, color);
    core.addColorStop(1, hexA(color, 0.85));
    g.fillStyle = core;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();

    return { img: c, size, half: size / 2 };
  }

  function seed() {
    const cols = palette();
    const count = Math.round(Math.min(44, Math.max(16, (W * H) / 44000)));
    balls = Array.from({ length: count }, (_, i) => {
      const r = 2.5 + Math.pow(Math.random(), 2.3) * 13;
      const ci = i % cols.length;
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        r,
        ci,
        color: cols[ci],
        lag: 20 + Math.random() * 820,   // how far back on the cursor's path it trails
        tau: 60 + Math.random() * 340,   // how quickly it closes the gap
        ox: (Math.random() - 0.5) * 52,  // small spread so they gather instead of stacking
        oy: (Math.random() - 0.5) * 52,
        drift: Math.random() * Math.PI * 2,
        sprite: makeSprite(cols[ci], r),
      };
    }).sort((a, b) => b.r - a.r);

    stars = Array.from({ length: Math.round(Math.min(170, (W * H) / 12000)) }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.1 + 0.2,
      p: Math.random() * Math.PI * 2,
    }));
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    trail.length = 0;
    seed();
    if (reduceMotion) drawStatic();
  }

  function pushTrail(x, y, now) {
    const tail = trail[trail.length - 1];
    if (tail && now - tail.t < 26) return;
    trail.push({ x, y, t: now });
    const cutoff = now - 1500;
    while (trail.length && trail[0].t < cutoff) trail.shift();
  }

  function sampleAt(now, lag) {
    const cutoff = now - lag;
    for (let i = trail.length - 1; i >= 0; i--) {
      if (trail[i].t <= cutoff) return trail[i];
    }
    return null;
  }

  function update(now, dt) {
    // no pointer yet, or it has been still for a while: drift a ghost target
    if (!pointer.active || now - pointer.last > 2400) {
      const t = now / 1000;
      pointer.x = W * 0.5 + Math.cos(t * 0.55) * W * 0.26;
      pointer.y = H * 0.46 + Math.sin(t * 0.8) * H * 0.2;
    }

    pushTrail(pointer.x, pointer.y, now);

    for (const b of balls) {
      const s = sampleAt(now, b.lag) || trail[0];
      if (!s) continue;
      b.drift += dt * 0.0007;
      const tx = s.x + b.ox + Math.cos(b.drift) * 7;
      const ty = s.y + b.oy + Math.sin(b.drift * 1.3) * 7;
      const f = 1 - Math.exp(-dt / b.tau);
      b.x += (tx - b.x) * f;
      b.y += (ty - b.y) * f;
    }
  }

  function draw(now) {
    const light = document.documentElement.dataset.theme === 'light';
    ctx.clearRect(0, 0, W, H);

    for (const st of stars) {
      const tw = 0.5 + Math.sin(now / 950 + st.p) * 0.35;
      ctx.globalAlpha = tw * (light ? 0.14 : 0.48);
      ctx.fillStyle = light ? '#33406b' : '#dfe8ff';
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // threads pulling each ball toward the convergence point
    ctx.lineWidth = 1;
    for (const b of balls) {
      const d = Math.hypot(pointer.x - b.x, pointer.y - b.y);
      if (d > 340) continue;
      ctx.globalAlpha = (1 - d / 340) * (light ? 0.1 : 0.18);
      ctx.strokeStyle = b.color;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(pointer.x, pointer.y);
      ctx.stroke();
    }

    ctx.globalAlpha = light ? 0.72 : 0.95;
    for (const b of balls) {
      ctx.drawImage(b.sprite.img, b.x - b.sprite.half, b.y - b.sprite.half, b.sprite.size, b.sprite.size);
    }
    ctx.globalAlpha = 1;

    // the point they are all converging on
    const pulse = 1 + Math.sin(now / 430) * 0.18;
    ctx.strokeStyle = light ? 'rgba(47, 85, 204, 0.55)' : 'rgba(205, 222, 255, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(pointer.x, pointer.y, 10 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = light ? 'rgba(47, 85, 204, 0.85)' : 'rgba(232, 240, 255, 0.92)';
    ctx.beginPath();
    ctx.arc(pointer.x, pointer.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawStatic() {
    const cx = W / 2, cy = H * 0.42;
    pointer.active = true;
    pointer.x = cx;
    pointer.y = cy;
    trail.length = 0;
    trail.push({ x: cx, y: cy, t: 0 });
    balls.forEach((b, i) => {
      const a = (i / balls.length) * Math.PI * 2;
      const rad = 18 + (i % 5) * 20;
      b.x = cx + Math.cos(a) * rad;
      b.y = cy + Math.sin(a) * rad;
    });
    draw(0);
  }

  function frame(now) {
    const dt = Math.min(64, now - last || 16);
    last = now;
    update(now, dt);
    draw(now);
    raf = requestAnimationFrame(frame);
  }

  window.addEventListener('pointermove', (e) => {
    pointer.active = true;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.last = performance.now();
  }, { passive: true });

  window.addEventListener('pointerdown', (e) => {
    pointer.active = true;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.last = performance.now();
  }, { passive: true });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 180);
  });

  // recolor when the theme flips
  new MutationObserver(() => {
    const cols = palette();
    for (const b of balls) {
      b.color = cols[b.ci % cols.length];
      b.sprite = makeSprite(b.color, b.r);
    }
    if (reduceMotion) drawStatic();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  document.addEventListener('visibilitychange', () => {
    if (reduceMotion) return;
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  });

  resize();
  if (!reduceMotion) {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
})();
