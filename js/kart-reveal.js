// Kart brush reveal — smooth brush + speed scratches
(() => {
  const container = document.getElementById('kartReveal');
  const canvas = document.getElementById('scratchCanvas');
  const cursorEl = document.getElementById('scratchCursor');
  if (!container || !canvas) return;

  const ctx = canvas.getContext('2d');
  const sketchImg = new Image();
  sketchImg.src = 'assets/images/sketch.png';
  const realImg = new Image();
  realImg.src = 'assets/images/real.png';

  // Temp canvas for compositing reveal (brush mask + real image)
  const tmpCanvas = document.createElement('canvas');
  const tmpCtx = tmpCanvas.getContext('2d');

  // Hide the <img> underneath — we now composite Real.png via canvas
  const realBase = container.querySelector('img.real-base');
  if (realBase) realBase.style.display = 'none';

  const BRUSH_SIZE = window.innerWidth <= 768 ? 200 : 400;
  const TRAIL_MAX = 30;
  const BLOB_COUNT = 5;
  let isInside = false;
  let mouseX = 0, mouseY = 0;
  let animId = null;
  let canvasW = 0, canvasH = 0;
  let trail = [];
  let time = 0; // for idle animation

  // ── Seeded random ──
  function mkRand(seed) {
    let s = seed;
    return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
  }

  // ── Pre-render organic liquid brush shape ──
  function createBrush(size, seed) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    const cx = size / 2, cy = size / 2, r = size * 0.42;
    const rand = mkRand(seed);

    // Organic liquid blob — irregular, stretched shape
    const segs = 48;
    const raw = [];
    // Wider variance for more organic feel
    for (let i = 0; i < segs; i++) raw.push(0.6 + rand() * 0.55);
    // Fewer smoothing passes = more irregular edges
    for (let p = 0; p < 3; p++) {
      for (let i = 0; i < segs; i++) {
        raw[i] = raw[i] * 0.5 + (raw[(i - 1 + segs) % segs] + raw[(i + 1) % segs]) * 0.25;
      }
    }
    // Add large-scale lobes for liquid drip/splat feel
    const lobeCount = 2 + Math.floor(rand() * 2); // 2-3 lobes
    for (let l = 0; l < lobeCount; l++) {
      const lobeAngle = rand() * segs;
      const lobeWidth = 3 + rand() * 5;
      const lobeMag = 0.15 + rand() * 0.2;
      for (let i = 0; i < segs; i++) {
        const dist = Math.min(Math.abs(i - lobeAngle), segs - Math.abs(i - lobeAngle));
        if (dist < lobeWidth) {
          raw[i] += lobeMag * (1 - dist / lobeWidth);
        }
      }
    }
    // Asymmetric stretch — wider than tall for paintbrush feel
    const stretchX = 1.15 + rand() * 0.2;
    const stretchY = 0.8 + rand() * 0.15;

    // Solid core
    g.fillStyle = 'rgba(0,0,0,1)';
    g.beginPath();
    for (let i = 0; i <= segs; i++) {
      const a = (i % segs) / segs * Math.PI * 2;
      const px = cx + Math.cos(a) * r * raw[i % segs] * stretchX;
      const py = cy + Math.sin(a) * r * raw[i % segs] * stretchY;
      i === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
    }
    g.closePath();
    g.fill();

    // Bristle texture — thin parallel lines clipped to the blob shape
    g.save();
    // Re-use the same blob path as a clip (with stretch)
    g.beginPath();
    for (let i = 0; i <= segs; i++) {
      const a = (i % segs) / segs * Math.PI * 2;
      const px = cx + Math.cos(a) * r * raw[i % segs] * stretchX;
      const py = cy + Math.sin(a) * r * raw[i % segs] * stretchY;
      i === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
    }
    g.closePath();
    g.clip();

    // Draw bristle lines at a slight angle for natural brush feel
    const bristleAngle = -0.25 + rand() * 0.5; // slight random tilt
    const cos_a = Math.cos(bristleAngle);
    const sin_a = Math.sin(bristleAngle);
    const bristleCount = Math.floor(size * 0.35);
    g.globalCompositeOperation = 'destination-out';

    for (let b = 0; b < bristleCount; b++) {
      const t = (b / bristleCount) * 2 - 1; // -1 to 1
      const offsetX = t * r * 0.95;
      const lineWidth = 0.3 + rand() * 0.6;
      const alpha = 0.08 + rand() * 0.14;

      // Slight waviness per bristle
      const wave1 = (rand() - 0.5) * 3;
      const wave2 = (rand() - 0.5) * 3;

      g.strokeStyle = `rgba(0,0,0,${alpha})`;
      g.lineWidth = lineWidth;
      g.beginPath();

      const x1 = cx + offsetX * cos_a - r * 1.1 * sin_a;
      const y1 = cy + offsetX * sin_a + r * 1.1 * cos_a;
      const x2 = cx + (offsetX + wave1) * cos_a + r * 1.1 * sin_a;
      const y2 = cy + (offsetX + wave1) * sin_a - r * 1.1 * cos_a;
      const mx = cx + (offsetX + wave2) * cos_a;
      const my = cy + (offsetX + wave2) * sin_a;

      g.moveTo(x1, y1);
      g.quadraticCurveTo(mx, my, x2, y2);
      g.stroke();
    }
    g.restore();

    // Soft feathered edge — elliptical to match stretch
    g.save();
    g.translate(cx, cy);
    g.scale(stretchX, stretchY);
    const grad = g.createRadialGradient(0, 0, r * 0.75, 0, 0, r * 1.1);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = grad;
    g.fillRect(-size, -size, size * 2, size * 2);
    g.restore();

    return c;
  }

  const brush = createBrush(BRUSH_SIZE * 2, 42);

  // Pre-render blob brushes (bigger)
  const blobBrushes = [];
  for (let i = 0; i < BLOB_COUNT; i++) {
    blobBrushes.push(createBrush(120, 100 + i * 777));
  }

  // Each blob orbits close to main brush so they merge/overlap
  const blobOrbits = [];
  const orbRand = mkRand(999);
  for (let i = 0; i < BLOB_COUNT; i++) {
    blobOrbits.push({
      dist: 0.28 + orbRand() * 0.3,       // close orbit → overlaps with main brush
      angle: orbRand() * Math.PI * 2,
      speed: 0.25 + orbRand() * 0.5,
      size: 40 + orbRand() * 50,           // big blobs (40–90px)
      alpha: 0.6 + orbRand() * 0.4,        // more opaque → merges visually
      phaseX: orbRand() * Math.PI * 2,
      phaseY: orbRand() * Math.PI * 2,
    });
  }

  // ── Canvas setup ──
  function initCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvasW = rect.width;
    canvasH = rect.height;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Sync temp canvas size
    tmpCanvas.width = canvas.width;
    tmpCanvas.height = canvas.height;
    tmpCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSketch();
  }

  // Draw image with object-fit: cover logic on a given context
  // objectY: 0 = top, 0.5 = center, 1 = bottom (default 0.35 to push image down)
  function drawCoverOn(target, img, w, h, objectY) {
    if (objectY === undefined) objectY = 0.25;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const boxRatio = w / h;
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (imgRatio > boxRatio) {
      sw = img.naturalHeight * boxRatio;
      sx = (img.naturalWidth - sw) / 2;
    } else {
      sh = img.naturalWidth / boxRatio;
      sy = (img.naturalHeight - sh) * objectY;
    }
    target.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  }

  function drawSketch() {
    ctx.globalCompositeOperation = 'source-over';
    drawCoverOn(ctx, sketchImg, canvasW, canvasH);
  }

  // ── Render ──
  function renderFrame() {
    time += 0.016; // ~60fps
    drawSketch();

    if (!isInside && trail.length === 0) return;
    if (!realImg.complete) return;

    // --- Step 1: Draw brush mask on temp canvas ---
    tmpCtx.clearRect(0, 0, canvasW, canvasH);
    tmpCtx.globalCompositeOperation = 'source-over';

    // Idle edge morph — slow rotation + asymmetric stretch
    const rot = Math.sin(time * 0.6) * 0.12 + Math.sin(time * 1.1) * 0.06;
    const scX = 1 + Math.sin(time * 0.9) * 0.05;
    const scY = 1 + Math.cos(time * 0.7) * 0.05;

    // Draw trail (older = smaller + more transparent)
    for (let i = 0; i < trail.length; i++) {
      const pt = trail[i];
      const t = (i + 1) / trail.length;
      const size = BRUSH_SIZE * (0.15 + t * 0.85);
      const h = size / 2;
      tmpCtx.globalAlpha = 0.08 + t * 0.65;
      tmpCtx.save();
      tmpCtx.translate(pt.x, pt.y);
      tmpCtx.rotate(rot * t);
      tmpCtx.drawImage(brush, -h, -h, size, size);
      tmpCtx.restore();
    }

    // Draw main brush at cursor with edge morphing
    if (isInside) {
      const mainSize = BRUSH_SIZE;
      const mh = mainSize / 2;
      tmpCtx.globalAlpha = 1;
      tmpCtx.save();
      tmpCtx.translate(mouseX, mouseY);
      tmpCtx.rotate(rot);
      tmpCtx.scale(scX, scY);
      tmpCtx.drawImage(brush, -mh, -mh, mainSize, mainSize);
      tmpCtx.restore();

      // Draw orbiting blobs (temporarily hidden)
      for (let i = 0; i < 0 && i < BLOB_COUNT; i++) {
        const b = blobOrbits[i];
        const orbitAngle = b.angle + time * b.speed;
        const dist = BRUSH_SIZE * b.dist;
        const wobX = Math.sin(time * 1.2 + b.phaseX) * 6;
        const wobY = Math.cos(time * 1.5 + b.phaseY) * 6;
        const bx = mouseX + Math.cos(orbitAngle) * dist + wobX;
        const by = mouseY + Math.sin(orbitAngle) * dist + wobY;
        const bSize = b.size * (1 + Math.sin(time * 2.2 + i) * 0.15);
        const bh = bSize / 2;
        tmpCtx.globalAlpha = b.alpha;
        tmpCtx.drawImage(blobBrushes[i], bx - bh, by - bh, bSize, bSize);
      }

      // Fine splatter particles (temporarily hidden)
      tmpCtx.fillStyle = 'rgba(0,0,0,1)';
      const splatterCount = 0;
      for (let i = 0; i < splatterCount; i++) {
        const a = (i / splatterCount) * Math.PI * 2 + time * 0.3;
        const dist = BRUSH_SIZE * (0.5 + Math.sin(time * 0.8 + i * 2.1) * 0.25);
        const sx = mouseX + Math.cos(a) * dist;
        const sy = mouseY + Math.sin(a) * dist;
        const sr = 1 + Math.sin(time * 1.5 + i * 3.3) * 0.5 + 0.5;
        tmpCtx.globalAlpha = 0.15 + Math.sin(time * 1.2 + i * 1.7) * 0.1;
        tmpCtx.beginPath();
        tmpCtx.arc(sx, sy, sr, 0, Math.PI * 2);
        tmpCtx.fill();
      }
    }

    // --- Step 2: Mask with Real.png using source-in ---
    // This keeps Real.png pixels ONLY where brush was drawn
    tmpCtx.globalAlpha = 1;
    tmpCtx.globalCompositeOperation = 'source-in';
    drawCoverOn(tmpCtx, realImg, canvasW, canvasH);

    // --- Step 3: Overlay the masked result onto main canvas ---
    // Both canvases share the same DPR transform, so draw at logical size
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    // Reset transform to draw pixel-to-pixel, then restore
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(tmpCanvas, 0, 0);
    ctx.restore();
  }

  // ── Animation loop ──
  function tick() {
    // Shrink trail when mouse leaves
    if (!isInside && trail.length > 0) {
      trail.shift();
    }

    renderFrame();

    // Keep running while inside (for idle breathing/blobs) or trail fading
    if (isInside || trail.length > 0) {
      animId = requestAnimationFrame(tick);
    } else {
      drawSketch();
      animId = null;
    }
  }

  function startLoop() {
    if (!animId) animId = requestAnimationFrame(tick);
  }

  // ── Events ──
  container.addEventListener('mouseenter', (e) => {
    isInside = true;
    cursorEl.classList.add('active');
    const rect = container.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    trail = [];
    startLoop();
  });

  container.addEventListener('mousemove', (e) => {
    cursorEl.style.left = e.clientX + 'px';
    cursorEl.style.top = e.clientY + 'px';
    if (!isInside) return;

    const rect = container.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;

    // Add to trail
    trail.push({ x: mouseX, y: mouseY });
    if (trail.length > TRAIL_MAX) trail.shift();
  });

  container.addEventListener('mouseleave', () => {
    isInside = false;
    cursorEl.classList.remove('active');
    startLoop();
  });

  // Mobile: scroll-driven reveal (left to right)
  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    let scrollRevealProgress = 0;
    let scrollRevealActive = false;

    function drawScrollReveal() {
      drawSketch();
      if (!realImg.complete || scrollRevealProgress <= 0) return;

      const p = Math.min(1, scrollRevealProgress);
      // Ease out cubic for smooth deceleration
      const ease = 1 - Math.pow(1 - p, 3);

      // Reveal width from left to right
      const revealW = canvasW * ease;

      // Draw real image clipped to reveal area with soft edge
      tmpCtx.clearRect(0, 0, canvasW, canvasH);
      tmpCtx.globalCompositeOperation = 'source-over';

      // Create soft edge gradient mask
      const edgeWidth = Math.min(80, revealW * 0.3);
      const grad = tmpCtx.createLinearGradient(revealW - edgeWidth, 0, revealW, 0);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');

      // Solid area
      tmpCtx.fillStyle = 'rgba(0,0,0,1)';
      tmpCtx.fillRect(0, 0, Math.max(0, revealW - edgeWidth), canvasH);

      // Soft edge
      tmpCtx.fillStyle = grad;
      tmpCtx.fillRect(Math.max(0, revealW - edgeWidth), 0, edgeWidth, canvasH);

      // Mask with real image
      tmpCtx.globalCompositeOperation = 'source-in';
      drawCoverOn(tmpCtx, realImg, canvasW, canvasH);

      // Overlay on main canvas
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(tmpCanvas, 0, 0);
      ctx.restore();
    }

    function onScrollReveal() {
      const rect = container.getBoundingClientRect();
      const vh = window.innerHeight;
      // Start when section enters viewport, complete when center of section reaches center of viewport
      const start = vh;
      const end = vh * 0.2;
      const raw = (start - rect.top) / (start - end);
      scrollRevealProgress = Math.max(0, Math.min(1, raw));
      drawScrollReveal();
    }

    window.addEventListener('scroll', onScrollReveal, { passive: true });
    if (typeof lenis !== 'undefined') {
      lenis.on('scroll', onScrollReveal);
    }

    // No touch events on mobile — scroll only
  } else {
    // Desktop: touch events (for touch-enabled desktops/tablets)
    container.addEventListener('touchstart', (e) => {
      e.preventDefault();
      isInside = true;
      const t = e.touches[0];
      const rect = container.getBoundingClientRect();
      mouseX = t.clientX - rect.left;
      mouseY = t.clientY - rect.top;
      trail = [];
      startLoop();
    }, { passive: false });

    container.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const rect = container.getBoundingClientRect();
      mouseX = t.clientX - rect.left;
      mouseY = t.clientY - rect.top;
      trail.push({ x: mouseX, y: mouseY });
      if (trail.length > TRAIL_MAX) trail.shift();
    }, { passive: false });

    container.addEventListener('touchend', () => {
      isInside = false;
      startLoop();
    });
  }

  // Init
  sketchImg.onload = () => {
    initCanvas();
    if (isMobile) {
      // Trigger initial scroll check
      const rect = container.getBoundingClientRect();
      if (rect.top < window.innerHeight) {
        setTimeout(() => window.dispatchEvent(new Event('scroll')), 100);
      }
    }
  };
  if (sketchImg.complete) initCanvas();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(initCanvas, 200);
  });
})();

// Form
function handleSubmit(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const orig = btn.innerHTML;
  btn.innerHTML = 'Submitting...';
  btn.disabled = true;
  setTimeout(() => {
    btn.innerHTML = 'Application Sent &#10003;';
    btn.style.background = '#1a7a1a';
    btn.style.color = '#ffffff';
    setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; btn.disabled = false; e.target.reset(); }, 3000);
  }, 1500);
}
