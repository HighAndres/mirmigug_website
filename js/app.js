/**
 * app.js (FULL REPLACE) - Mirmibug
 * - Menú móvil robusto
 * - Cookies banner + acceptCookies()
 * - Glow spotlight (Soluciones + panel KPI)
 * - Footer year
 * - Cotizador PRO (validaciones + resumen claro + WhatsApp)
 * - Contact Form (POST a /api/contact.php) + fallback anti-WAF
 */

/* =========================
   HELPERS
========================= */
const $ = (id) => document.getElementById(id);

const money = (n) =>
  n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  });

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

const safeInt = (value, fallback = 0) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const textOfSelect = (sel) =>
  sel?.options?.[sel.selectedIndex]?.text || sel?.value || "";

/* =========================
   DOM READY
========================= */
document.addEventListener("DOMContentLoaded", () => {
  initMobileMenu();
  initFooterYear();
  initCookies();
  initGlowSpotlight();
  initCotizador();
  initContactForm();
});

/* =========================
   MENU MÓVIL
========================= */
function initMobileMenu() {
  const menuBtn = $("menuBtn");
  const mobileMenu = $("mobileMenu");

  menuBtn?.addEventListener("click", () => {
    mobileMenu?.classList.toggle("hidden");
  });

  document.querySelectorAll("#mobileMenu a").forEach((a) => {
    a.addEventListener("click", () => {
      mobileMenu?.classList.add("hidden");
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") mobileMenu?.classList.add("hidden");
  });
}

/* =========================
   FOOTER YEAR
========================= */
function initFooterYear() {
  const yearEl = $("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

/* =========================
   COOKIES
========================= */
function initCookies() {
  const COOKIE_KEY = "cookiesAccepted";
  const cookieBanner = $("cookie-banner");
  const cookiesAccepted = localStorage.getItem(COOKIE_KEY);

  if (!cookiesAccepted) cookieBanner?.classList.remove("hidden");
}

function acceptCookies() {
  localStorage.setItem("cookiesAccepted", "true");
  $("cookie-banner")?.classList.add("hidden");
}
window.acceptCookies = acceptCookies;

/* =========================
   GLOW SPOTLIGHT
   - Aplica a .solution-item y .stack-layer (panel derecho)
========================= */
function initGlowSpotlight() {
  const items = document.querySelectorAll(".solution-item, .stack-layer");
  items.forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--x", `${e.clientX - rect.left}px`);
      card.style.setProperty("--y", `${e.clientY - rect.top}px`);
    });
  });
}

/* =========================
   COTIZADOR PRO
========================= */
function initCotizador() {
  const qUsers = $("q_users");
  const qUsersVal = $("q_users_val");
  const qSites = $("q_sites");
  const qSupport = $("q_support");
  const qHours = $("q_hours");
  const qServers = $("q_servers");
  const qUrgency = $("q_urgency");

  const mHelpdesk = $("m_helpdesk");
  const mM365 = $("m_m365");
  const mMonitor = $("m_monitor");
  const mBackup = $("m_backup");
  const mSecurity = $("m_security");
  const mNetwork = $("m_network");
  const mServers = $("m_servers");
  const mProjects = $("m_projects");

  const qPrice = $("q_price");
  const qBreakdown = $("q_breakdown");
  const quoteSummary = $("quote_summary");
  const qBadgePlan = $("q_badge_plan");
  const qPriceNote = $("q_price_note");

  const btnCalc = $("q_btn_calc");
  const btnReset = $("q_btn_reset");
  const btnWhatsapp = $("q_btn_whatsapp");

  const required = [
    qUsers, qSites, qSupport, qHours, qServers, qUrgency,
    qPrice, qBreakdown, quoteSummary, btnWhatsapp
  ];
  if (required.some((el) => !el)) return;

  const PRICING = {
    plans: [
      { name: "Plan Esencial", base: 2500, includedUsers: 5, extraUser: 250 },
      { name: "Plan Profesional", base: 5500, includedUsers: 15, extraUser: 220 },
      { name: "Plan Empresarial", base: 9500, includedUsers: 30, extraUser: 200 },
    ],
    extraSite: 800,
    serverMonthly: 900,
    supportMultiplier: { remote: 1.0, hybrid: 1.15, onsite: 1.35 },
    hoursMultiplier: { buss: 1.0, plus: 1.2, 247: 1.6 },
    urgencyMultiplier: { std: 1.0, prio: 1.12, crit: 1.25 },
    modules: {
      helpdesk: { label: "Help Desk & Tickets", monthly: 0, included: true },
      monitor: { label: "Monitoreo (equipos/servidores/red)", monthly: 0, included: true },
      m365: { label: "Correo & M365 / Workspace", monthly: 600 },
      backup: { label: "Backups & Recuperación", monthly: 900 },
      security: { label: "Seguridad (hardening, MFA, EDR/AV)", monthly: 1200 },
      network: { label: "Redes (WiFi, switches, firewall, VPN)", monthly: 900 },
      servers: { label: "Servidores & Virtualización", monthly: 1200 },
      projects: { label: "Bolsa de cambios / Proyectos", monthly: 1500 },
    },
    note:
      "Estimado mensual. No incluye licencias (M365/EDR/Backup cloud), hardware, ni proyectos one-time fuera de la bolsa.",
  };

  if (mHelpdesk) { mHelpdesk.checked = true; mHelpdesk.disabled = true; }
  if (mMonitor) { mMonitor.checked = true; mMonitor.disabled = true; }

  function pickPlan(users) {
    if (users <= PRICING.plans[0].includedUsers) return PRICING.plans[0];
    if (users <= PRICING.plans[1].includedUsers) return PRICING.plans[1];
    return PRICING.plans[2];
  }

  function renderBreakdown(breakdown, multLines) {
    qBreakdown.innerHTML = `
      <div class="break-items">
        ${breakdown.map(item => `
          <div class="break-item">
            <span class="break-label">${item.label}</span>
            <span class="break-val">${money(item.value)}</span>
          </div>`).join("")}
      </div>
      ${multLines.length ? `<div class="break-mults"><strong>Ajustes operativos:</strong><br>${multLines.join("<br>")}</div>` : ""}
      <div class="break-note">${PRICING.note}</div>
    `;
  }

  function calc() {
    const users = clamp(safeInt(qUsers.value, 5), 5, 300);
    qUsers.value = String(users);

    const sitesRaw = safeInt(qSites.value, 1);
    const sites = clamp(sitesRaw, 1, 4);

    const support = qSupport.value;
    const hours = qHours.value;
    const urgency = qUrgency.value;

    const serversCount = clamp(safeInt(qServers.value || "0", 0), 0, 50);
    qServers.value = String(serversCount);

    if (qUsersVal) qUsersVal.textContent = String(users);

    const plan = pickPlan(users);
    if (qBadgePlan) qBadgePlan.textContent = plan.name;

    let subtotal = plan.base;
    const breakdown = [];
    breakdown.push({ label: `${plan.name} (incluye hasta ${plan.includedUsers} usuarios)`, value: plan.base });

    const extraUsers = Math.max(0, users - plan.includedUsers);
    if (extraUsers > 0) {
      const extraUsersCost = extraUsers * plan.extraUser;
      subtotal += extraUsersCost;
      breakdown.push({ label: `Usuarios adicionales (${extraUsers} × ${money(plan.extraUser)})`, value: extraUsersCost });
    }

    const extraSites = Math.max(0, sites - 1);
    if (extraSites > 0) {
      const extraSitesCost = extraSites * PRICING.extraSite;
      subtotal += extraSitesCost;
      breakdown.push({ label: `Sedes adicionales (${extraSites} × ${money(PRICING.extraSite)})`, value: extraSitesCost });
    }

    if (serversCount > 0) {
      const serverCost = serversCount * PRICING.serverMonthly;
      subtotal += serverCost;
      breakdown.push({ label: `Administración de servidores (${serversCount} × ${money(PRICING.serverMonthly)})`, value: serverCost });
    }

    const modulesSelected = [];
    const addModule = (checked, key) => {
      if (!checked) return;
      const m = PRICING.modules[key];
      modulesSelected.push(m.label);
      subtotal += m.monthly || 0;
      breakdown.push({ label: `Módulo: ${m.label}${m.included ? " (Incluido)" : ""}`, value: m.monthly || 0 });
    };

    addModule(true, "helpdesk");
    addModule(true, "monitor");
    addModule(!!mM365?.checked, "m365");
    addModule(!!mBackup?.checked, "backup");
    addModule(!!mSecurity?.checked, "security");
    addModule(!!mNetwork?.checked, "network");
    addModule(!!mServers?.checked, "servers");
    addModule(!!mProjects?.checked, "projects");

    const multSupport = PRICING.supportMultiplier[support] ?? 1.0;
    const multHours = PRICING.hoursMultiplier[hours] ?? 1.0;
    const multUrgency = PRICING.urgencyMultiplier[urgency] ?? 1.0;
    const multiplier = multSupport * multHours * multUrgency;

    const total = Math.round((subtotal * multiplier) / 10) * 10;

    const multLines = [];
    if (multSupport !== 1) multLines.push(`Soporte (${textOfSelect(qSupport)}) × ${multSupport}`);
    if (multHours !== 1) multLines.push(`Horario (${textOfSelect(qHours)}) × ${multHours}`);
    if (multUrgency !== 1) multLines.push(`SLA (${textOfSelect(qUrgency)}) × ${multUrgency}`);

    qPrice.textContent = `${money(total)} / mes`;
    if (qPriceNote) qPriceNote.textContent = PRICING.note;

    renderBreakdown(breakdown, multLines);

    const summary = [
      `Cotización Mirmibug (Estimado mensual)`,
      `Plan base: ${plan.name}`,
      `Usuarios: ${users} (incluye ${plan.includedUsers}, extra: ${extraUsers})`,
      `Sedes: ${sites === 4 ? "4+ sedes" : sites} (extra: ${extraSites})`,
      `Soporte: ${textOfSelect(qSupport)}`,
      `Horario: ${textOfSelect(qHours)}`,
      `SLA: ${textOfSelect(qUrgency)}`,
      `Servidores: ${serversCount}`,
      `Módulos: ${modulesSelected.join(", ")}`,
      `Total estimado: ${money(total)} / mes`,
      ``,
      `Incluye: Help Desk & Tickets + Monitoreo base.`,
      `No incluye: licencias (M365/EDR/Backup cloud), hardware, ni proyectos one-time fuera de la bolsa.`,
      `Sujeto a inventario y SLA final.`,
    ].join("\n");

    quoteSummary.value = summary;

    const phone = "525527970496";
    btnWhatsapp.href = `https://wa.me/${phone}?text=${encodeURIComponent(summary)}`;
  }

  function reset() {
    qUsers.value = "25";
    if (qUsersVal) qUsersVal.textContent = "25";

    qSites.value = "1";
    qSupport.value = "remote";
    qHours.value = "buss";
    qServers.value = "0";
    qUrgency.value = "std";

    if (mM365) mM365.checked = false;
    if (mBackup) mBackup.checked = false;
    if (mSecurity) mSecurity.checked = false;
    if (mNetwork) mNetwork.checked = false;
    if (mServers) mServers.checked = false;
    if (mProjects) mProjects.checked = false;

    qPrice.textContent = "$0 MXN";
    qBreakdown.innerHTML = "";
    quoteSummary.value = "";
    btnWhatsapp.href = "#";

    calc();
  }

  qUsers.addEventListener("input", calc);
  [qSites, qSupport, qHours, qServers, qUrgency, mM365, mBackup, mSecurity, mNetwork, mServers, mProjects].forEach((el) => {
    el?.addEventListener("change", calc);
    el?.addEventListener("input", calc);
  });

  btnCalc?.addEventListener("click", (e) => { e.preventDefault?.(); calc(); });
  btnReset?.addEventListener("click", (e) => { e.preventDefault?.(); reset(); });

  calc();
}

/* =========================
   CONTACT FORM (ANTI-WAF)
========================= */
function initContactForm() {
  const form = $("contactForm");
  if (!form) return;

  let iframe = document.getElementById("contact_iframe");
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = "contact_iframe";
    iframe.name = "contact_iframe";
    iframe.style.display = "none";
    document.body.appendChild(iframe);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = form.querySelector("button[type='submit']");
    const originalText = btn ? btn.textContent : "";

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Enviando...";
    }

    const fd = new FormData(form);
    fd.set("origen", window.location.href);

    const qs = $("quote_summary")?.value || "";
    if (qs) fd.set("quote_summary", qs);

    const endpoint = form.getAttribute("action") || "/api/contact.php";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });

      const text = await res.text();
      let data = {};
      try { data = JSON.parse(text); } catch (_) {}

      if (res.ok && data.ok) {
        form.reset();
        alert("¡Mensaje enviado! ✅");
        return;
      }

      console.warn("Fetch blocked or failed:", res.status, text);
      await fallbackSubmit(form, iframe);

    } catch (err) {
      console.warn("Fetch error -> fallback submit", err);
      await fallbackSubmit(form, iframe);

    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    }
  });
}

function fallbackSubmit(form, iframe) {
  return new Promise((resolve) => {
    const oldTarget = form.getAttribute("target");
    form.setAttribute("target", "contact_iframe");

    const onLoad = () => {
      iframe.removeEventListener("load", onLoad);
      form.reset();
      alert("Envío realizado. Si no recibes respuesta, el hosting está bloqueando el endpoint y hay que ajustar ModSecurity.");

      if (oldTarget) form.setAttribute("target", oldTarget);
      else form.removeAttribute("target");

      resolve();
    };

    iframe.addEventListener("load", onLoad);
    form.submit();
  });
}