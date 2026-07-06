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

  let maxT = 0; // Track highest progress — never go backwards
  let currentOffset = 100; // Current visual offset (for lerp)
  let rafId = null;

  function update() {
    const rect = heading.getBoundingClientRect();
    const vh = window.innerHeight;
    const start = vh;
    const end = vh * 0.3;
    const raw = 1 - (rect.top - end) / (start - end);
    const t = Math.max(0, Math.min(1, raw));

    // Only allow forward progress — prevents Safari bounce-back
    maxT = Math.max(maxT, t);

    const ease = 1 - Math.pow(1 - maxT, 3);
    const targetOffset = (1 - ease) * 100;

    // Lerp for smoother transitions (prevents jitter)
    currentOffset += (targetOffset - currentOffset) * 0.3;

    left.style.transform = `translateX(${-currentOffset}%)`;
    right.style.transform = `translateX(${currentOffset}%)`;

    // Keep animating until settled
    if (Math.abs(currentOffset - targetOffset) > 0.1) {
      rafId = requestAnimationFrame(update);
    } else {
      rafId = null;
    }
  }

  function onScroll() {
    if (!rafId) rafId = requestAnimationFrame(update);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // initial check
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
        previewImg.src = '/assets/images/' + gear;
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

// Kart slider — autoplay + drag/grab + arrows + dots
(() => {
  const slider = document.getElementById('kartSlider');
  const track = document.getElementById('kartTrack');
  const dotsWrap = document.getElementById('kartDots');
  if (!slider || !track) return;

  const slides = Array.from(track.children);
  const count = slides.length;
  let index = 0;
  let autoTimer = null;
  const AUTOPLAY_MS = 4000;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Build dots
  const dots = slides.map((_, i) => {
    const b = document.createElement('button');
    b.setAttribute('aria-label', `Go to slide ${i + 1}`);
    b.addEventListener('click', () => { goTo(i); restartAuto(); });
    dotsWrap.appendChild(b);
    return b;
  });

  function render(animate = true) {
    track.style.transition = animate ? 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
    track.style.transform = `translateX(${-index * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === index));
  }

  function goTo(i) {
    index = (i + count) % count;
    render();
  }
  const next = () => goTo(index + 1);
  const prev = () => goTo(index - 1);

  // Arrows
  const prevBtn = document.getElementById('kartPrev');
  const nextBtn = document.getElementById('kartNext');
  if (prevBtn) prevBtn.addEventListener('click', () => { prev(); restartAuto(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { next(); restartAuto(); });

  // Autoplay
  function startAuto() {
    if (reduceMotion || autoTimer) return;
    autoTimer = setInterval(next, AUTOPLAY_MS);
  }
  function stopAuto() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  }
  function restartAuto() { stopAuto(); startAuto(); }

  slider.addEventListener('mouseenter', stopAuto);
  slider.addEventListener('mouseleave', startAuto);

  // Drag / grab (pointer events for mouse + touch)
  let dragging = false;
  let startX = 0;
  let deltaX = 0;
  let width = slider.offsetWidth;

  slider.addEventListener('pointerdown', (e) => {
    // Don't start a drag when pressing the arrows or dots — let their click fire
    if (e.target.closest('.kart-arrow') || e.target.closest('.kart-dots')) return;
    dragging = true;
    startX = e.clientX;
    deltaX = 0;
    width = slider.offsetWidth;
    stopAuto();
    slider.classList.add('dragging');
    slider.setPointerCapture(e.pointerId);
    track.style.transition = 'none';
  });

  slider.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    deltaX = e.clientX - startX;
    const pct = (deltaX / width) * 100;
    track.style.transform = `translateX(${-index * 100 + pct}%)`;
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    slider.classList.remove('dragging');
    const threshold = width * 0.15;
    if (deltaX > threshold) prev();
    else if (deltaX < -threshold) next();
    else render();
    restartAuto();
  }
  slider.addEventListener('pointerup', endDrag);
  slider.addEventListener('pointercancel', endDrag);

  window.addEventListener('resize', () => { width = slider.offsetWidth; render(false); });

  render(false);
  startAuto();
})();

