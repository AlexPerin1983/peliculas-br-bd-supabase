const menuToggle = document.querySelector('[data-menu-toggle]');
const navigation = document.querySelector('[data-nav]');
const header = document.querySelector('[data-header]');

function closeMenu() {
  if (!menuToggle || !navigation) return;
  menuToggle.setAttribute('aria-expanded', 'false');
  navigation.classList.remove('is-open');
  document.body.classList.remove('menu-open');
}

if (menuToggle && navigation) {
  menuToggle.addEventListener('click', () => {
    const willOpen = menuToggle.getAttribute('aria-expanded') !== 'true';
    menuToggle.setAttribute('aria-expanded', String(willOpen));
    navigation.classList.toggle('is-open', willOpen);
    document.body.classList.toggle('menu-open', willOpen);
  });

  navigation.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
}

function updateHeader() {
  header?.classList.toggle('is-scrolled', window.scrollY > 24);
}

window.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();

document.querySelectorAll('.accordion details').forEach((details) => {
  details.addEventListener('toggle', () => {
    if (!details.open) return;
    document.querySelectorAll('.accordion details').forEach((other) => {
      if (other !== details) other.removeAttribute('open');
    });
  });
});

const revealElements = document.querySelectorAll('[data-reveal]');

if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -35px' });

  revealElements.forEach((element) => revealObserver.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add('is-visible'));
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const scrollProgress = document.querySelector('[data-scroll-progress]');

function updateScrollProgress() {
  if (!scrollProgress) return;
  const available = document.documentElement.scrollHeight - window.innerHeight;
  const progress = available > 0 ? Math.min(1, window.scrollY / available) : 0;
  scrollProgress.style.width = `${progress * 100}%`;
}

window.addEventListener('scroll', updateScrollProgress, { passive: true });
window.addEventListener('resize', updateScrollProgress);
updateScrollProgress();

const compare = document.querySelector('[data-compare]');
const compareRange = document.querySelector('[data-compare-range]');

function updateCompare(value) {
  compare?.style.setProperty('--split', `${value}%`);
}

if (compareRange) {
  compareRange.addEventListener('input', () => updateCompare(compareRange.value));
  updateCompare(compareRange.value);
}

const calculatorInputs = Object.fromEntries(
  [...document.querySelectorAll('[data-calc]')].map((input) => [input.dataset.calc, input]),
);

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

function updateCalculator() {
  const volume = Number(calculatorInputs.volume?.value || 0);
  const waste = Number(calculatorInputs.waste?.value || 0);
  const cost = Number(calculatorInputs.cost?.value || 0);
  const wastedMeters = volume * (waste / 100);
  const yearlyCost = wastedMeters * cost * 12;

  const volumeOutput = document.querySelector('[data-output="volume"]');
  const wasteOutput = document.querySelector('[data-output="waste"]');
  const costOutput = document.querySelector('[data-output="cost"]');
  const metersResult = document.querySelector('[data-result="meters"]');
  const moneyResult = document.querySelector('[data-result="money"]');

  if (volumeOutput) volumeOutput.textContent = `${volume} m²`;
  if (wasteOutput) wasteOutput.textContent = `${waste}%`;
  if (costOutput) costOutput.textContent = `${formatCurrency(cost)}/m²`;
  if (metersResult) metersResult.textContent = `${wastedMeters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m²`;
  if (moneyResult) moneyResult.textContent = formatCurrency(yearlyCost);
}

Object.values(calculatorInputs).forEach((input) => input?.addEventListener('input', updateCalculator));
updateCalculator();

if (!reduceMotion && window.matchMedia('(pointer: fine)').matches) {
  const cursorDot = document.querySelector('[data-cursor-dot]');
  const cursorRing = document.querySelector('[data-cursor-ring]');
  const cursorLabel = cursorRing?.querySelector('span');
  let pointerX = window.innerWidth / 2;
  let pointerY = window.innerHeight / 2;
  let ringX = pointerX;
  let ringY = pointerY;

  window.addEventListener('pointermove', (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
    document.body.classList.add('has-cursor');
    if (cursorDot) cursorDot.style.transform = `translate(${pointerX}px,${pointerY}px) translate(-50%,-50%)`;

    const normalizedX = (event.clientX / window.innerWidth) - 0.5;
    const normalizedY = (event.clientY / window.innerHeight) - 0.5;
    document.querySelectorAll('[data-parallax]').forEach((element) => {
      const strength = Number(element.dataset.parallax || 12);
      element.style.setProperty('--parallax-x', `${normalizedX * strength}px`);
      element.style.setProperty('--parallax-y', `${normalizedY * strength}px`);
    });
  }, { passive: true });

  document.documentElement.addEventListener('mouseleave', () => document.body.classList.remove('has-cursor'));

  function renderCursor() {
    ringX += (pointerX - ringX) * 0.16;
    ringY += (pointerY - ringY) * 0.16;
    if (cursorRing) cursorRing.style.transform = `translate(${ringX}px,${ringY}px) translate(-50%,-50%)`;
    requestAnimationFrame(renderCursor);
  }
  renderCursor();

  document.querySelectorAll('a,button,input,[data-cursor]').forEach((element) => {
    element.addEventListener('mouseenter', () => {
      document.body.classList.add('cursor-active');
      if (cursorLabel) cursorLabel.textContent = element.dataset.cursor || (element.matches('input') ? 'MEXA' : 'ABRIR');
    });
    element.addEventListener('mouseleave', () => document.body.classList.remove('cursor-active'));
  });

  document.querySelectorAll('[data-magnetic]').forEach((element) => {
    element.addEventListener('pointermove', (event) => {
      const rect = element.getBoundingClientRect();
      element.style.setProperty('--magnetic-x', `${(event.clientX - rect.left - rect.width / 2) * 0.16}px`);
      element.style.setProperty('--magnetic-y', `${(event.clientY - rect.top - rect.height / 2) * 0.16}px`);
    });
    element.addEventListener('pointerleave', () => {
      element.style.setProperty('--magnetic-x', '0px');
      element.style.setProperty('--magnetic-y', '0px');
    });
  });

  document.querySelectorAll('[data-tilt]').forEach((element) => {
    element.addEventListener('pointermove', (event) => {
      const rect = element.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      element.style.transform = `perspective(1000px) rotateX(${-y * 5}deg) rotateY(${x * 7}deg)`;
    });
    element.addEventListener('pointerleave', () => {
      element.style.transform = '';
    });
  });
}
