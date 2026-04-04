// Lenis smooth scroll
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smooth: true,
  smoothTouch: false,
});

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// Anchor links work with Lenis
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      e.preventDefault();
      lenis.scrollTo(target);
    }
  });
});

// Reveal
const obs = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

// Nav scroll
const nav = document.getElementById('navbar');
window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 40));

// Why heading — scroll-driven slide from sides
(() => {
  const heading = document.querySelector('.why-heading');
  if (!heading) return;
  const left = heading.querySelector('.why-left');
  const right = heading.querySelector('.why-right');

  function update() {
    const rect = heading.getBoundingClientRect();
    const vh = window.innerHeight;
    // Start animating when heading enters bottom of viewport,
    // finish when it reaches 30% from top
    const start = vh;          // heading bottom edge enters viewport
    const end = vh * 0.3;      // heading reaches upper portion
    const raw = 1 - (rect.top - end) / (start - end); // 0 → 1
    const t = Math.max(0, Math.min(1, raw));

    // Ease out cubic for smooth deceleration
    const ease = 1 - Math.pow(1 - t, 3);

    const offset = (1 - ease) * 100; // 100% → 0%
    left.style.transform = `translateX(${-offset}%)`;
    right.style.transform = `translateX(${offset}%)`;
  }

  window.addEventListener('scroll', update, { passive: true });
  update(); // initial check
})();

// Finish line checkered pattern with scroll animation
(() => {
  const canvas = document.getElementById('finishCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  let W, H, cellW;
  const cols = 27;
  const totalRows = 8;
  const red = '#D91212';
  const dark = '#1a1a1a';

  function hash(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  function resize() {
    W = canvas.parentElement.clientWidth;
    H = window.innerHeight * 1.5; // 150vh
    cellW = W / cols;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.height = H + 'px';
  }

  const visibleRows = 3;
  const extraRows = 5;
  const poolRows = 30; // large pool so rows keep coming from below

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const rect = canvas.parentElement.getBoundingClientRect();
    const vh = window.innerHeight;

    // Raw scroll: how far the section has moved from its initial position
    // Positive = scrolled up. Continuous, not clamped.
    const distFromStart = vh - rect.top;
    const totalTravel = vh + rect.height;
    const scrollRaw = Math.max(0, distFromStart / totalTravel);

    // offset = how many rows have shifted (continuous, negative = scroll down)
    const offset = -scrollRaw * (totalRows + extraRows);

    // Center the 3 visible rows vertically in canvas
    const gridTop = (H - visibleRows * cellW) / 2;

    // Dark background below the visible grid rows (jagged edge hidden behind blocks)
    const bgTop = gridTop + visibleRows * cellW - cellW * 0.3;
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let col = 0; col <= cols; col++) {
      const rand = hash(col * 5.5, 99.9);
      const jag = bgTop + (rand - 0.5) * cellW * 0.8;
      ctx.lineTo(col * cellW, jag);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    for (let i = 0; i < poolRows; i++) {
      // rowPos relative to visible zone: 0~2 = visible, <0 = fly out, >=3 = build in
      const rowPos = i - extraRows + offset;

      const baseY = gridTop + rowPos * cellW;

      // Skip if way off screen
      if (baseY < -cellW * 5 || baseY > H + cellW * 5) continue;

      for (let col = 0; col < cols; col++) {
        const isRed = (col + i) % 2 === 0;
        const blockSeed = hash(col * 13.3, i * 7.7);
        const speedVar = 0.7 + blockSeed * 0.6;

        let scale = 1;
        let yShift = 0;

        if (rowPos < 0) {
          // === FLY OUT (above visible zone) ===
          const fi = Math.min(1, Math.abs(rowPos) / 6); // slower: 6 rows to fully disappear
          const fi2 = Math.min(1, fi * speedVar * 1.1);
          scale = Math.max(0, 1 - fi2);
          yShift = fi2 * cellW * 5 * speedVar;
        } else if (rowPos >= visibleRows) {
          // === BUILD IN (below visible zone) ===
          const dist = rowPos - visibleRows; // 0 = just entered build zone
          const t = Math.min(1, dist / 3);

          // Scale: small when far, full size when joining grid
          scale = 1 - t * t;
          if (scale <= 0) continue;

          // Squeeze width: random per block, max 70% squeeze when far
          const squeezeSeed = hash(col * 11.2, i * 4.6);
          const squeezeAmount = 0.3 + squeezeSeed * 0.7; // 0.3 - 1.0
          const scaleW = scale * (1 - t * 0.7 * squeezeAmount);

          const finalW = cellW * scaleW;
          const finalH = cellW * scale;
          const cx = col * cellW + cellW / 2;
          const cy = baseY + cellW / 2;

          ctx.fillStyle = isRed ? red : dark;
          ctx.fillRect(cx - finalW / 2, cy - finalH / 2, finalW, finalH);
          continue;
        }

        if (scale <= 0) continue;

        const finalW = cellW * scale;
        const finalH = cellW * scale;
        const cx = col * cellW + cellW / 2;
        const cy = baseY + cellW / 2 - yShift;

        ctx.fillStyle = isRed ? red : dark;
        ctx.fillRect(cx - finalW / 2, cy - finalH / 2, finalW, finalH);
      }
    }
  }

  function onScroll() {
    draw();
  }

  resize();
  draw();

  window.addEventListener('resize', () => { resize(); draw(); });
  window.addEventListener('scroll', onScroll, { passive: true });

  // Also hook into Lenis if available
  if (typeof lenis !== 'undefined') {
    lenis.on('scroll', onScroll);
  }
})();

// Mobile nav
const toggle = document.getElementById('navToggle');
const links = document.getElementById('navLinks');
toggle.addEventListener('click', () => links.classList.toggle('open'));
links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));

// Programs spotlight rotation on hover
(() => {
  const section = document.querySelector('.programs-section');
  const spotlight = document.querySelector('.programs-spotlight');
  if (!section || !spotlight) return;

  // Base polygon points: [x, y] in %
  const base = [
    [0, 60], [100, 0], [45, 100], [0, 100]
  ];

  // Anchor = top-right corner (spotlight origin)
  const anchor = [100, 0];

  function toClip(pts) {
    return `polygon(${pts.map(p => `${p[0]}% ${p[1]}%`).join(', ')})`;
  }

  function rotatePoint(p, angle) {
    const dx = p[0] - anchor[0];
    const dy = p[1] - anchor[1];
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return [
      anchor[0] + dx * cos - dy * sin,
      anchor[1] + dx * sin + dy * cos
    ];
  }

  section.addEventListener('mousemove', (e) => {
    const rect = section.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Rotation angle based on cursor (radians), follows mouse direction
    const angle = -((x - 0.5) * 0.18) - ((y - 0.5) * 0.10);

    const rotated = base.map(p => rotatePoint(p, angle));
    spotlight.style.setProperty('--spot-clip', toClip(rotated));
  });

  section.addEventListener('mouseleave', () => {
    spotlight.style.removeProperty('--spot-clip');
  });
})();

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', function(e) {
    e.preventDefault();
    const t = document.querySelector(this.getAttribute('href'));
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// Gear preview on hover
(() => {
  const previewImg = document.getElementById('gearPreviewImg');
  if (!previewImg) return;
  const gearItems = document.querySelectorAll('.gear-item[data-gear]');
  const defaultSrc = previewImg.src;

  gearItems.forEach(item => {
    item.addEventListener('mouseenter', () => {
      const gear = item.getAttribute('data-gear');
      previewImg.style.opacity = '0';
      setTimeout(() => {
        previewImg.src = 'assets/images/' + gear;
        previewImg.style.opacity = '1';
      }, 150);
    });

    item.addEventListener('mouseleave', () => {
      previewImg.style.opacity = '0';
      setTimeout(() => {
        previewImg.src = defaultSrc;
        previewImg.style.opacity = '1';
      }, 150);
    });
  });
})();

