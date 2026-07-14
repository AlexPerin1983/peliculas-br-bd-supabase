const config = window.WindowFilmsConfig || {};

document.querySelectorAll("[data-app-home]").forEach((link) => {
  if (config.appBaseUrl) link.href = config.appBaseUrl;
});

document.querySelector("[data-year]").textContent = new Date().getFullYear();

const header = document.querySelector("[data-header]");
const progress = document.querySelector(".page-progress span");
const workflow = document.querySelector("#fluxo");
const workflowProgress = document.querySelector("[data-workflow-progress]");

function updateScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  const ratio = max > 0 ? scrollY / max : 0;
  progress.style.width = `${ratio * 100}%`;
  header.classList.toggle("scrolled", scrollY > 40);

  if (workflow) {
    const rect = workflow.getBoundingClientRect();
    const distance = workflow.offsetHeight - innerHeight * 0.45;
    const local = Math.min(1, Math.max(0, -rect.top / Math.max(1, distance)));
    workflowProgress.style.width = `${local * 100}%`;
  }
}

addEventListener("scroll", updateScroll, { passive: true });
updateScroll();

const menuButton = document.querySelector("[data-menu-button]");
const mobileMenu = document.querySelector("[data-mobile-menu]");
menuButton.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") !== "true";
  menuButton.setAttribute("aria-expanded", String(open));
  mobileMenu.classList.toggle("open", open);
});
mobileMenu.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
  mobileMenu.classList.remove("open");
  menuButton.setAttribute("aria-expanded", "false");
}));

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: "0px 0px -5%" });
document.querySelectorAll(".reveal").forEach((node) => revealObserver.observe(node));

const cursor = document.querySelector(".cursor-light");
addEventListener("pointermove", (event) => {
  cursor.style.left = `${event.clientX}px`;
  cursor.style.top = `${event.clientY}px`;
}, { passive: true });

const tintRange = document.querySelector("[data-tint-range]");
const tintFilter = document.querySelector("[data-tint-filter]");
const tintHandle = document.querySelector("[data-tint-handle]");
function updateTint() {
  const value = Number(tintRange.value);
  tintFilter.style.width = `${value}%`;
  tintHandle.style.left = `${value}%`;
}
tintRange.addEventListener("input", updateTint);
updateTint();

const segments = {
  arquitetonico: {
    index: "01 / 03",
    kicker: "Projetos que pedem escala",
    title: "Do primeiro vão à fachada completa.",
    description: "Cadastre ambientes, agrupe medidas, compare películas e entregue propostas profissionais para residências, escritórios e fachadas.",
    image: "assets/mascote-medicao-v1.png",
    webp: "assets/mascote-medicao-v1.webp",
    alt: "Mascote estilete medindo vidros de um projeto comercial",
    items: ["Medidas por ambiente e abertura", "Comparativo de películas na proposta", "Acompanhamento por peça aplicada"]
  },
  automotivo: {
    index: "02 / 03",
    kicker: "Atendimento rápido, registro completo",
    title: "Do veículo na agenda à película aplicada.",
    description: "Organize modelos, vidros, opções de película, valores e horário de instalação sem perder o histórico do cliente.",
    image: "assets/mascote-automotivo-v1.png",
    webp: "assets/mascote-automotivo-v1.webp",
    alt: "Mascote estilete aplicando película automotiva",
    items: ["Cadastro do veículo e dos vidros", "Agenda de aplicação e lembretes", "Histórico para garantia e pós-venda"]
  },
  decorativo: {
    index: "03 / 03",
    kicker: "Privacidade que também comunica",
    title: "Projetos únicos, apresentados com clareza.",
    description: "Estruture opções para divisórias, vitrines e ambientes especiais, com cada medida e acabamento no lugar certo.",
    image: "assets/mascote-hero-window-v1.png",
    webp: "assets/mascote-hero-window-v1.webp",
    alt: "Mascote estilete aplicando película em vidro arquitetônico",
    items: ["Organização por ambiente e desenho", "Várias opções no mesmo orçamento", "Material e execução no mesmo fluxo"]
  }
};

const panel = document.querySelector("[data-segment-panel]");
const visual = panel.querySelector(".segment-visual");
const panelImage = panel.querySelector("[data-segment-image]");
const panelSource = panel.querySelector("[data-segment-source]");

document.querySelectorAll("[data-segment]").forEach((button) => {
  button.addEventListener("click", () => {
    const data = segments[button.dataset.segment];
    document.querySelectorAll("[data-segment]").forEach((tab) => {
      const active = tab === button;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    visual.classList.add("changing");
    setTimeout(() => {
      panelImage.src = data.image;
      panelImage.alt = data.alt;
      panelSource.srcset = data.webp;
      panel.querySelector("[data-segment-index]").textContent = data.index;
      panel.querySelector("[data-segment-kicker]").textContent = data.kicker;
      panel.querySelector("[data-segment-title]").textContent = data.title;
      panel.querySelector("[data-segment-description]").textContent = data.description;
      panel.querySelector("[data-segment-list]").innerHTML = data.items.map((item) => `<li><i>✓</i> ${item}</li>`).join("");
      visual.classList.remove("changing");
    }, 180);
  });
});

const meters = document.querySelector("[data-meters]");
const cost = document.querySelector("[data-cost]");
const waste = document.querySelector("[data-waste]");
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
function updateCalculator() {
  document.querySelector("[data-meters-output]").textContent = meters.value;
  document.querySelector("[data-cost-output]").textContent = cost.value;
  document.querySelector("[data-waste-output]").textContent = waste.value;
  const result = Number(meters.value) * Number(cost.value) * (Number(waste.value) / 100);
  document.querySelector("[data-calculator-result]").textContent = currency.format(result);
}
[meters, cost, waste].forEach((input) => input.addEventListener("input", updateCalculator));
updateCalculator();

document.querySelectorAll(".faq details").forEach((detail) => {
  detail.addEventListener("toggle", () => {
    if (!detail.open) return;
    document.querySelectorAll(".faq details").forEach((other) => {
      if (other !== detail) other.open = false;
    });
  });
});
