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

  section.addEventListener('mousemove', (e) => {
    const rect = section.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;   // 0 → 1
    const y = (e.clientY - rect.top) / rect.height;    // 0 → 1
    const rot = 6 - (x * 8) - (y * 4);
    spotlight.style.setProperty('--spot-rotation', `${rot}deg`);
  });

  section.addEventListener('mouseleave', () => {
    spotlight.style.removeProperty('--spot-rotation');
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

