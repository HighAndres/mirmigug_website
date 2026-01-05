// MENU MÓVIL
const menuBtn = document.getElementById("menuBtn");
const mobileMenu = document.getElementById("mobileMenu");

menuBtn.addEventListener("click", () => {
  mobileMenu.classList.toggle("hidden");
});


// ===============================
// COTIZADOR MIRMIBUG - PRICING LOGIC
// Basado en pisos rentables:
// Esencial $2,500 (<=5) | Profesional $5,500 (<=15) | Empresarial $9,500 (<=30)
// ===============================

(function () {
  // Helpers
  const $ = (id) => document.getElementById(id);
  const money = (n) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

  // Inputs
  const qUsers = $("q_users");
  const qUsersVal = $("q_users_val");
  const qSites = $("q_sites");
  const qSupport = $("q_support");
  const qHours = $("q_hours");
  const qServers = $("q_servers");
  const qUrgency = $("q_urgency");

  // Modules
  const mHelpdesk = $("m_helpdesk");
  const mM365 = $("m_m365");
  const mMonitor = $("m_monitor");
  const mBackup = $("m_backup");
  const mSecurity = $("m_security");
  const mNetwork = $("m_network");
  const mServers = $("m_servers");
  const mProjects = $("m_projects");

  // Outputs
  const qPrice = $("q_price");
  const qBreakdown = $("q_breakdown");
  const quoteSummary = $("quote_summary");

  // Buttons
  const btnCalc = $("q_btn_calc");
  const btnReset = $("q_btn_reset");
  const btnWhatsapp = $("q_btn_whatsapp");

  // -------------------------------
  // Configuración de precios
  // -------------------------------
  const PRICING = {
    plans: [
      { name: "Plan Esencial", base: 2500, includedUsers: 5, extraUser: 250 },
      { name: "Plan Profesional", base: 5500, includedUsers: 15, extraUser: 220 },
      { name: "Plan Empresarial", base: 9500, includedUsers: 30, extraUser: 200 },
      // Para 31+ usuarios seguimos con piso Empresarial + extraUser
    ],

    // Sedes adicionales (1 sede incluida)
    extraSite: 800, // por sede extra

    // Tipo de soporte
    supportMultiplier: {
      remote: 1.0,
      hybrid: 1.15,
      onsite: 1.35,
    },

    // Horario
    hoursMultiplier: {
      buss: 1.0,  // 8x5
      plus: 1.2,  // 12x6
      247: 1.6,   // 24/7
    },

    // Urgencia / SLA
    urgencyMultiplier: {
      std: 1.0,
      prio: 1.12,
      crit: 1.25,
    },

    // Servidores (si aplica)
    serverMonthly: 900, // por servidor/mes (administración base)

    // Módulos (sumas mensuales)
    modules: {
      helpdesk: { label: "Help Desk & Tickets", monthly: 0 }, // lo consideramos base por defecto
      m365: { label: "Correo & M365 / Workspace", monthly: 600 },
      monitor: { label: "Monitoreo (equipos/servidores/red)", monthly: 0 }, // puede ir incluido como parte del base
      backup: { label: "Backups & Recuperación", monthly: 900 },
      security: { label: "Seguridad (hardening, MFA, EDR/AV)", monthly: 1200 },
      network: { label: "Redes (WiFi, switches, firewall, VPN)", monthly: 900 },
      servers: { label: "Servidores & Virtualización", monthly: 1200 },
      projects: { label: "Bolsa de cambios / Proyectos", monthly: 1500 },
    },

    // Nota legal / comercial
    note: "Estimado mensual. La cotización final depende de alcance, inventario y SLA.",
  };

  // -------------------------------
  // Lógica de selección de plan
  // -------------------------------
  function pickPlan(users) {
    if (users <= PRICING.plans[0].includedUsers) return PRICING.plans[0];
    if (users <= PRICING.plans[1].includedUsers) return PRICING.plans[1];
    // 16..30 o más, piso empresarial
    return PRICING.plans[2];
  }

  function calc() {
    const users = parseInt(qUsers.value, 10);
    const sites = parseInt(qSites.value, 10);
    const support = qSupport.value;
    const hours = qHours.value;
    const urgency = qUrgency.value;
    const serversCount = Math.max(0, parseInt(qServers.value || "0", 10));

    const plan = pickPlan(users);

    // 1) Base plan
    let subtotal = plan.base;
    const breakdown = [];
    breakdown.push({ label: `${plan.name} (incluye hasta ${plan.includedUsers} usuarios)`, value: plan.base });

    // 2) Usuarios extra
    const extraUsers = Math.max(0, users - plan.includedUsers);
    if (extraUsers > 0) {
      const extraUsersCost = extraUsers * plan.extraUser;
      subtotal += extraUsersCost;
      breakdown.push({ label: `Usuarios adicionales (${extraUsers} × ${money(plan.extraUser)})`, value: extraUsersCost });
    }

    // 3) Sedes extra (1 incluida)
    const extraSites = Math.max(0, sites - 1);
    if (extraSites > 0) {
      const extraSitesCost = extraSites * PRICING.extraSite;
      subtotal += extraSitesCost;
      breakdown.push({ label: `Sedes adicionales (${extraSites} × ${money(PRICING.extraSite)})`, value: extraSitesCost });
    }

    // 4) Servidores (input numérico)
    if (serversCount > 0) {
      const serverCost = serversCount * PRICING.serverMonthly;
      subtotal += serverCost;
      breakdown.push({ label: `Administración de servidores (${serversCount} × ${money(PRICING.serverMonthly)})`, value: serverCost });
    }

    // 5) Módulos
    const modulesSelected = [];
    const addModule = (checked, key) => {
      if (!checked) return;
      const m = PRICING.modules[key];
      modulesSelected.push(m.label);
      if (m.monthly > 0) {
        subtotal += m.monthly;
        breakdown.push({ label: `Módulo: ${m.label}`, value: m.monthly });
      } else {
        breakdown.push({ label: `Módulo: ${m.label}`, value: 0 });
      }
    };

    addModule(mHelpdesk.checked, "helpdesk");
    addModule(mM365.checked, "m365");
    addModule(mMonitor.checked, "monitor");
    addModule(mBackup.checked, "backup");
    addModule(mSecurity.checked, "security");
    addModule(mNetwork.checked, "network");
    addModule(mServers.checked, "servers");
    addModule(mProjects.checked, "projects");

    // 6) Multiplicadores (soporte/horario/SLA)
    const multSupport = PRICING.supportMultiplier[support] ?? 1.0;
    const multHours = PRICING.hoursMultiplier[hours] ?? 1.0;
    const multUrgency = PRICING.urgencyMultiplier[urgency] ?? 1.0;

    const multiplier = multSupport * multHours * multUrgency;

    // Aplicamos multiplicador al subtotal (en vez de “sumar”, para reflejar carga operativa)
    const total = Math.round(subtotal * multiplier);

    // Breakdown de multiplicadores (solo si > 1)
    const multLines = [];
    if (multSupport > 1) multLines.push(`Soporte (${qSupport.options[qSupport.selectedIndex].text}) × ${multSupport}`);
    if (multHours > 1) multLines.push(`Horario (${qHours.options[qHours.selectedIndex].text}) × ${multHours}`);
    if (multUrgency > 1) multLines.push(`SLA (${qUrgency.options[qUrgency.selectedIndex].text}) × ${multUrgency}`);

    // Render
    qPrice.textContent = `${money(total)} / mes`;
    qBreakdown.innerHTML = `
      <div class="break-items">
        ${breakdown
          .map(
            (item) => `
          <div class="break-item">
            <span class="break-label">${item.label}</span>
            <span class="break-val">${money(item.value)}</span>
          </div>`
          )
          .join("")}
      </div>
      ${multLines.length ? `<div class="break-mults"><strong>Ajustes operativos:</strong><br>${multLines.join("<br>")}</div>` : ""}
      <div class="break-note">${PRICING.note}</div>
    `;

    // Summary (para formulario / whatsapp)
    const summary = [
      `Cotización Mirmibug (Estimado mensual)`,
      `Plan base: ${plan.name}`,
      `Usuarios: ${users} (incluye ${plan.includedUsers}, extra: ${extraUsers})`,
      `Sedes: ${sites} (extra: ${extraSites})`,
      `Soporte: ${qSupport.options[qSupport.selectedIndex].text}`,
      `Horario: ${qHours.options[qHours.selectedIndex].text}`,
      `SLA: ${qUrgency.options[qUrgency.selectedIndex].text}`,
      `Servidores: ${serversCount}`,
      `Módulos: ${modulesSelected.length ? modulesSelected.join(", ") : "Ninguno"}`,
      `Total estimado: ${money(total)} / mes`,
      ``,
      `Nota: La cotización final depende de alcance, inventario y SLA.`,
    ].join("\n");

    quoteSummary.value = summary;

    // WhatsApp link (cambia el número por el tuyo)
    const phone = "5210000000000"; // <-- PON AQUÍ TU NÚMERO EN FORMATO INTERNACIONAL (Ej: 5215512345678)
    const text = encodeURIComponent(summary);
    btnWhatsapp.href = `https://wa.me/${phone}?text=${text}`;
  }

  function reset() {
    qUsers.value = 25;
    qUsersVal.textContent = "25";
    qSites.value = "1";
    qSupport.value = "remote";
    qHours.value = "buss";
    qServers.value = 0;
    qUrgency.value = "std";

    // Módulos default (como los tienes)
    mHelpdesk.checked = true;
    mM365.checked = false;
    mMonitor.checked = true;
    mBackup.checked = false;
    mSecurity.checked = false;
    mNetwork.checked = false;
    mServers.checked = false;
    mProjects.checked = false;

    qPrice.textContent = "$0 MXN";
    qBreakdown.innerHTML = "";
    quoteSummary.value = "";
    btnWhatsapp.href = "#";
  }

  // UI: mostrar valor del slider
  if (qUsers && qUsersVal) {
    qUsersVal.textContent = qUsers.value;
    qUsers.addEventListener("input", () => (qUsersVal.textContent = qUsers.value));
  }

  // Actions
  btnCalc?.addEventListener("click", calc);
  btnReset?.addEventListener("click", reset);

  // Opcional: recalcular automáticamente al cambiar campos
  const autoRecalcIds = ["q_users", "q_sites", "q_support", "q_hours", "q_servers", "q_urgency",
    "m_helpdesk", "m_m365", "m_monitor", "m_backup", "m_security", "m_network", "m_servers", "m_projects"
  ];
  autoRecalcIds.forEach((id) => $(id)?.addEventListener("change", () => calc()));
})();

// Servicios animacion
document.querySelectorAll(".card").forEach(card => {
  card.addEventListener("mousemove", e => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--x", `${e.clientX - rect.left}px`);
    card.style.setProperty("--y", `${e.clientY - rect.top}px`);
  });
});
