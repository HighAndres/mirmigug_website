/* =========================
   COTIZADOR DE VENTAS — v2 con historial, descuento, config empresa y precios admin
   Mirmibug IT Solutions · México
========================= */

'use strict';

const API_BASE = 'api/vendors.php';

// ── Fallback para desarrollo local (sin servidor PHP) ──
const LOCAL_DEV_USERS = [
  { id: 'V001', name: 'Andres', pin: 'mirmi2026', role: 'admin' }
];
const IS_LOCALHOST = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname.endsWith('github.io');

// ─────────────────────────────────────────
// CATÁLOGO DE SERVICIOS (precios base — sobreescritos desde admin si existen)
// ─────────────────────────────────────────
const SERVICES_DEFAULT = [
  {
    id: 'helpdesk', name: 'HELP DESK', sub: '8×5 remoto',
    icon: '🖥️', base: 3500, varRate: 380,
    varLabel: 'Usuarios', varUnit: 'usuario', defaultQty: 5, min: 1,
    hourlyRate: 450, hourlyDefault: 10,
    desc: 'Soporte remoto, tickets ilimitados razonables, altas/bajas, soporte M365/Google, documentación básica, SLA estándar.'
  },
  {
    id: 'monitoreo', name: 'MONITOREO', sub: 'RMM proactivo',
    icon: '📡', base: 2000, varRate: 120,
    varLabel: 'Equipos', varUnit: 'equipo', defaultQty: 10, min: 1,
    hourlyRate: 500, hourlyDefault: 8,
    desc: 'Monitoreo de salud (CPU, RAM, disco), alertas, inventario, parches básicos, prevención de fallas.'
  },
  {
    id: 'seguridad', name: 'SEGURIDAD', sub: 'Endpoint EDR',
    icon: '🛡️', base: 2500, varRate: 180,
    varLabel: 'Usuarios', varUnit: 'usuario', defaultQty: 5, min: 1,
    hourlyRate: 550, hourlyDefault: 8,
    desc: 'Protección antivirus/EDR, políticas de seguridad base, hardening inicial, respuesta básica ante incidentes.'
  },
  {
    id: 'redes', name: 'REDES', sub: 'Admin. básica',
    icon: '🌐', base: 2800, varRate: 90,
    varLabel: 'Dispositivos', varUnit: 'dispositivo', defaultQty: 5, min: 1,
    hourlyRate: 500, hourlyDefault: 10,
    desc: 'Gestión de firewall, switches y APs, cambios menores, respaldo de configuración, monitoreo de red.'
  },
  {
    id: 'infra', name: 'INFRA', sub: 'Servidores / Cloud',
    icon: '🖧', base: 4500, varRate: 750,
    varLabel: 'Servidores', varUnit: 'servidor', defaultQty: 1, min: 1,
    hourlyRate: 750, hourlyDefault: 10,
    desc: 'Gestión de servidores, monitoreo, revisión de backups, mantenimiento preventivo, soporte cloud básico.'
  },
  {
    id: 'desarrollo', name: 'DESARROLLO', sub: 'Automatización',
    icon: '⚙️', base: 0, varRate: 750,
    varLabel: 'Horas / mes', varUnit: 'hora', defaultQty: 10, min: 1,
    hourlyRate: 750, hourlyDefault: 10,
    desc: 'Scripts, automatizaciones, mejoras internas, integraciones técnicas a medida.'
  },
  {
    id: 'bi', name: 'BI & DATA', sub: 'Dashboards / SQL',
    icon: '📊', base: 3000, varRate: 650,
    varLabel: 'Horas / mes', varUnit: 'hora', defaultQty: 5, min: 1,
    hourlyRate: 650, hourlyDefault: 10,
    desc: 'Desarrollo de dashboards, consultas SQL, reportes ejecutivos, automatización de datos.'
  },
  {
    id: 'ia', name: 'INTEGRACIONES IA', sub: 'APIs + Bots',
    icon: '🤖', base: 4000, varRate: 850,
    varLabel: 'Horas / mes', varUnit: 'hora', defaultQty: 5, min: 1,
    hourlyRate: 850, hourlyDefault: 8,
    desc: 'Integración con APIs de IA, bots internos, automatizaciones inteligentes, pruebas y despliegue inicial.'
  },
  {
    id: 'sitio', name: 'SITIO CDMX', sub: 'Visita presencial',
    icon: '📍', base: 1200, varRate: 1800,
    varLabel: 'Visitas / mes', varUnit: 'visita', defaultQty: 1, min: 0,
    hourlyRate: 650, hourlyDefault: 4,
    desc: 'Atención presencial, troubleshooting físico, instalaciones, revisión de red o equipos en sitio.'
  }
];

// ─────────────────────────────────────────
// CATÁLOGO DE EQUIPOS (precios sugeridos editables)
// ─────────────────────────────────────────
const EQUIP_CATALOG_DEFAULT = [
  { id: 'laptop',   name: 'Laptop',        icon: '💻', defaultPrice: 18500 },
  { id: 'desktop',  name: 'Desktop',        icon: '🖥️', defaultPrice: 14000 },
  { id: 'server',   name: 'Servidor',       icon: '🗄️', defaultPrice: 45000 },
  { id: 'switch',   name: 'Switch',         icon: '🔌', defaultPrice: 12000 },
  { id: 'firewall', name: 'Firewall',       icon: '🛡️', defaultPrice: 25000 },
  { id: 'ups',      name: 'UPS',            icon: '🔋', defaultPrice: 8000 },
  { id: 'ap',       name: 'Access Point',   icon: '📡', defaultPrice: 6500 },
];

// Catálogos mutables (se sobreescriben con precios admin)
let SERVICES     = SERVICES_DEFAULT.map(s => ({ ...s }));
let EQUIP_CATALOG = EQUIP_CATALOG_DEFAULT.map(e => ({ ...e }));

// ─────────────────────────────────────────
// ESTADO GLOBAL
// ─────────────────────────────────────────
const activeModules = new Set();
const svcModes = {};          // { svcId: 'mensual' | 'hora' | 'proyecto' }
let equipmentItems = [];      // [{ uid, catalogId, name, qty, unitPrice }]
let equipUidCounter = 0;
let prevTotalMensual = 0;
let prevTotalUnico   = 0;
let currentFolio = null;
let companyConfig = {};       // datos empresa cargados del servidor
let _allHistorial = [];       // cache para búsqueda en historial

// ─────────────────────────────────────────
// USUARIOS: helpers
// ─────────────────────────────────────────
function getCurrentUser() {
  try { return JSON.parse(sessionStorage.getItem('cv_user')); }
  catch { return null; }
}

function getAdminToken()  { return sessionStorage.getItem('cv_admin')  || ''; }
function getVendorToken() { return sessionStorage.getItem('cv_vendor') || ''; }

function isAdmin() {
  const u = getCurrentUser();
  return u && u.role === 'admin';
}

function logout() {
  sessionStorage.removeItem('cv_auth');
  sessionStorage.removeItem('cv_user');
  sessionStorage.removeItem('cv_admin');
  sessionStorage.removeItem('cv_vendor');
  location.reload();
}

// ─────────────────────────────────────────
// PIN GATE (server-side auth)
// ─────────────────────────────────────────
function initPin() {
  if (sessionStorage.getItem('cv_auth') === '1' && sessionStorage.getItem('cv_user')) {
    showApp();
    return;
  }

  const input = document.getElementById('pinInput');
  document.getElementById('pinBtn').addEventListener('click', checkPin);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') checkPin(); });
  setTimeout(() => input.focus(), 150);
}

async function checkPin() {
  const pin = document.getElementById('pinInput').value.trim();
  if (!pin) return;

  const btn = document.getElementById('pinBtn');
  btn.disabled = true;
  btn.textContent = 'VERIFICANDO...';

  try {
    const res = await fetch(`${API_BASE}?action=login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const data = await res.json();

    if (data.ok) {
      sessionStorage.setItem('cv_auth', '1');
      sessionStorage.setItem('cv_user', JSON.stringify(data.user));
      if (data.vendor_token) sessionStorage.setItem('cv_vendor', data.vendor_token);
      if (data.admin_token)  sessionStorage.setItem('cv_admin',  data.admin_token);
      showApp();
    } else {
      showPinError();
    }
  } catch (e) {
    // Fallback local
    if (IS_LOCALHOST) {
      const match = LOCAL_DEV_USERS.find(u => u.pin === pin);
      if (match) {
        const user = { id: match.id, name: match.name, role: match.role };
        sessionStorage.setItem('cv_auth', '1');
        sessionStorage.setItem('cv_user', JSON.stringify(user));
        sessionStorage.setItem('cv_vendor', 'local-dev-vendor-token');
        if (match.role === 'admin') sessionStorage.setItem('cv_admin', 'local-dev-token');
        showApp();
        return;
      }
    }
    const err = document.getElementById('pinError');
    err.textContent = '⚠ ERROR DE CONEXIÓN';
    err.style.display = 'block';
    setTimeout(() => { err.textContent = '⚠ ACCESO DENEGADO'; err.style.display = 'none'; }, 3000);
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'INICIAR SESIÓN <span class="pin-arrow">→</span>';
  }
}

function showPinError() {
  const err = document.getElementById('pinError');
  err.textContent = '⚠ ACCESO DENEGADO';
  err.style.display = 'block';
  document.getElementById('pinInput').value = '';
  document.getElementById('pinInput').focus();
  setTimeout(() => { err.style.display = 'none'; }, 2500);
}

function showApp() {
  document.getElementById('pinGate').style.display = 'none';
  document.getElementById('app').style.display     = 'block';
  initApp();
}

// ─────────────────────────────────────────
// INIT APP
// ─────────────────────────────────────────
function initApp() {
  document.getElementById('currentDate').textContent =
    new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();

  const user = getCurrentUser();
  if (user) {
    const badge = document.getElementById('userBadge');
    badge.textContent = `${user.id} // ${user.name}`;
    badge.style.display = 'inline-block';
    document.getElementById('logoutBtn').style.display = 'inline-block';

    const vendedorInput = document.getElementById('vendedor');
    vendedorInput.value = user.name;
    vendedorInput.readOnly = true;
    vendedorInput.style.opacity = '0.7';
    vendedorInput.style.cursor = 'default';

    if (user.role === 'admin') {
      document.getElementById('adminBtn').style.display = 'inline-block';
    }
  }

  // Cargar configuración de empresa y precios desde servidor
  loadCompanyConfig();
  loadPriceOverrides();

  renderCards();
  renderEquipSection();
  updateSummary();

  const token = new URLSearchParams(window.location.search).get('propuesta');
  if (token) loadSharedQuote(token);

  window.addEventListener('beforeprint', buildPrintView);
}

// ─────────────────────────────────────────
// CONFIG: CARGAR EMPRESA Y PRECIOS
// ─────────────────────────────────────────
async function loadCompanyConfig() {
  try {
    const res  = await fetch('api/company-config.php?action=get_company');
    const data = await res.json();
    if (data.ok) companyConfig = data.config || {};
  } catch { /* sin servidor: usar vacío */ }
}

async function loadPriceOverrides() {
  try {
    const res  = await fetch('api/company-config.php?action=get_prices');
    const data = await res.json();
    if (data.ok && data.prices && typeof data.prices === 'object') {
      applyPriceOverrides(data.prices);
    }
  } catch { /* usar precios por defecto */ }
}

function applyPriceOverrides(overrides) {
  if (overrides.services) {
    SERVICES = SERVICES_DEFAULT.map(svc => {
      const ov = overrides.services[svc.id];
      if (!ov) return { ...svc };
      return {
        ...svc,
        base:        ov.base        > 0 ? ov.base        : svc.base,
        varRate:     ov.varRate     > 0 ? ov.varRate     : svc.varRate,
        hourlyRate:  ov.hourlyRate  > 0 ? ov.hourlyRate  : svc.hourlyRate,
      };
    });
  }
  if (overrides.equip) {
    EQUIP_CATALOG = EQUIP_CATALOG_DEFAULT.map(eq => {
      const ov = overrides.equip[eq.id];
      if (!ov) return { ...eq };
      return { ...eq, defaultPrice: ov.defaultPrice > 0 ? ov.defaultPrice : eq.defaultPrice };
    });
  }
  // Re-render cards with updated prices
  renderCards();
  renderEquipSection();
}

// ─────────────────────────────────────────
// RENDER SERVICE CARDS
// ─────────────────────────────────────────
function renderCards() {
  const grid = document.getElementById('svcGrid');
  if (!grid) return;

  grid.innerHTML = SERVICES.map(svc => {
    const rateTag = svc.base > 0
      ? `$${fmt2(svc.base)} base · $${fmt2(svc.varRate)}/${svc.varUnit}`
      : `$${fmt2(svc.varRate)} / ${svc.varUnit}`;

    return `
      <div class="svc-card" id="card_${svc.id}" onclick="handleCardClick(event,'${svc.id}')">

        <div class="svc-status">
          <span class="svc-status-dot" id="sdot_${svc.id}"></span>
          <span id="stxt_${svc.id}">OFF</span>
        </div>

        <span class="svc-icon">${svc.icon}</span>
        <div class="svc-name">${svc.name}</div>
        <div class="svc-sub">${svc.sub}</div>

        <div class="svc-subtotal" id="csub_${svc.id}"></div>

        <div class="svc-mode-toggle" id="mode_${svc.id}">
          <button type="button" class="svc-mode-btn active" data-mode="mensual" onclick="event.stopPropagation();setMode('${svc.id}','mensual')">MENSUAL</button>
          <button type="button" class="svc-mode-btn" data-mode="hora" onclick="event.stopPropagation();setMode('${svc.id}','hora')">HORA</button>
          <button type="button" class="svc-mode-btn" data-mode="proyecto" onclick="event.stopPropagation();setMode('${svc.id}','proyecto')">PROYECTO</button>
        </div>

        <div class="svc-controls svc-ctrl-mensual" id="ctrl_mensual_${svc.id}">
          <div class="svc-qty-label">${svc.varLabel.toUpperCase()}</div>
          <div class="svc-qty-row">
            <button type="button" onclick="event.stopPropagation();adjustQty('${svc.id}',-1)">−</button>
            <input type="number" id="qty_${svc.id}" value="${svc.defaultQty}"
              min="${svc.min}" max="999"
              onclick="event.stopPropagation()"
              oninput="updateSummary()" />
            <button type="button" onclick="event.stopPropagation();adjustQty('${svc.id}',1)">+</button>
          </div>
        </div>

        <div class="svc-controls svc-ctrl-hora" id="ctrl_hora_${svc.id}" style="display:none">
          <div class="svc-qty-label">HORAS</div>
          <div class="svc-qty-row">
            <button type="button" onclick="event.stopPropagation();adjustHours('${svc.id}',-1)">−</button>
            <input type="number" id="hrs_${svc.id}" value="${svc.hourlyDefault}"
              min="1" max="999"
              onclick="event.stopPropagation()"
              oninput="updateSummary()" />
            <button type="button" onclick="event.stopPropagation();adjustHours('${svc.id}',1)">+</button>
          </div>
          <div class="svc-qty-label" style="margin-top:8px">TARIFA / HR</div>
          <div class="svc-qty-row">
            <span class="svc-rate-prefix">$</span>
            <input type="number" id="rate_${svc.id}" value="${svc.hourlyRate}"
              min="1" max="99999"
              onclick="event.stopPropagation()"
              oninput="updateSummary()" />
          </div>
        </div>

        <div class="svc-controls svc-ctrl-proyecto" id="ctrl_proyecto_${svc.id}" style="display:none">
          <div class="svc-qty-label">MONTO DEL PROYECTO</div>
          <div class="svc-qty-row">
            <span class="svc-rate-prefix">$</span>
            <input type="number" id="proj_${svc.id}" value="0"
              min="0" max="9999999"
              onclick="event.stopPropagation()"
              oninput="updateSummary()"
              placeholder="Monto total" />
          </div>
        </div>

        <div class="svc-rate">${rateTag}</div>
        <button class="svc-close" onclick="event.stopPropagation();deactivateModule('${svc.id}')">✕ quitar</button>
      </div>`;
  }).join('');
}

// ─────────────────────────────────────────
// MODE TOGGLE
// ─────────────────────────────────────────
function getMode(id) { return svcModes[id] || 'mensual'; }

function setMode(id, mode) {
  svcModes[id] = mode;

  const toggleEl = document.getElementById('mode_' + id);
  if (toggleEl) {
    toggleEl.querySelectorAll('.svc-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
  }

  ['mensual', 'hora', 'proyecto'].forEach(m => {
    const ctrl = document.getElementById(`ctrl_${m}_${id}`);
    if (ctrl) ctrl.style.display = (m === mode) ? 'block' : 'none';
  });

  updateSummary();
}

// ─────────────────────────────────────────
// CARD INTERACTION
// ─────────────────────────────────────────
function handleCardClick(event, id) {
  if (activeModules.has(id)) return;
  activateModule(id);
}

function activateModule(id) {
  activeModules.add(id);
  if (!svcModes[id]) svcModes[id] = 'mensual';

  const card = document.getElementById('card_' + id);
  if (card) card.classList.add('active');
  const stxt = document.getElementById('stxt_' + id);
  if (stxt) stxt.textContent = 'ON';
  const cnt = document.getElementById('activeCount');
  if (cnt) cnt.textContent = activeModules.size;

  setMode(id, svcModes[id]);
  updateSummary();
  typeTerminalLine();
}

function deactivateModule(id) {
  activeModules.delete(id);
  const card = document.getElementById('card_' + id);
  if (card) card.classList.remove('active');
  const stxt = document.getElementById('stxt_' + id);
  if (stxt) stxt.textContent = 'OFF';
  const csub = document.getElementById('csub_' + id);
  if (csub) csub.textContent = '';
  const cnt = document.getElementById('activeCount');
  if (cnt) cnt.textContent = activeModules.size;

  ['mensual', 'hora', 'proyecto'].forEach(m => {
    const ctrl = document.getElementById(`ctrl_${m}_${id}`);
    if (ctrl) ctrl.style.display = 'none';
  });

  updateSummary();
}

function adjustQty(id, delta) {
  const svc   = SERVICES.find(s => s.id === id);
  const input = document.getElementById('qty_' + id);
  input.value = Math.max(svc.min, (parseInt(input.value) || svc.defaultQty) + delta);
  updateSummary();
}

function adjustHours(id, delta) {
  const input = document.getElementById('hrs_' + id);
  input.value = Math.max(1, (parseInt(input.value) || 1) + delta);
  updateSummary();
}

// ─────────────────────────────────────────
// CALCULAR SERVICIO
// ─────────────────────────────────────────
function calcSvc(id) {
  const svc  = SERVICES.find(s => s.id === id);
  const mode = getMode(id);

  if (mode === 'mensual') {
    const qty = Math.max(svc.min, parseInt(document.getElementById('qty_' + id)?.value) || svc.defaultQty);
    const variable = qty * svc.varRate;
    return { mode, base: svc.base, qty, variable, varUnit: svc.varUnit, varRate: svc.varRate, total: svc.base + variable };
  }
  if (mode === 'hora') {
    const hrs  = Math.max(1, parseInt(document.getElementById('hrs_' + id)?.value) || svc.hourlyDefault);
    const rate = Math.max(1, parseInt(document.getElementById('rate_' + id)?.value) || svc.hourlyRate);
    return { mode, hours: hrs, hourlyRate: rate, total: hrs * rate };
  }
  if (mode === 'proyecto') {
    const amount = Math.max(0, parseFloat(document.getElementById('proj_' + id)?.value) || 0);
    return { mode, total: amount };
  }
  return { mode: 'mensual', base: 0, qty: 0, variable: 0, total: 0 };
}

function fmt(n)  { return '$' + Math.round(n).toLocaleString('es-MX'); }
function fmt2(n) { return Math.round(n).toLocaleString('es-MX'); }
function val(id) { return document.getElementById(id)?.value?.trim() || ''; }

function getDescuento() {
  const pct = parseFloat(document.getElementById('descuentoPct')?.value || '0') || 0;
  return Math.min(100, Math.max(0, pct));
}

// ─────────────────────────────────────────
// EQUIPOS: RENDER SECCIÓN
// ─────────────────────────────────────────
function renderEquipSection() {
  const section = document.getElementById('equipSection');
  if (!section) return;

  let chipsHtml = EQUIP_CATALOG.map(eq =>
    `<button type="button" class="equip-chip" onclick="addEquipment('${eq.id}')">${eq.icon} ${eq.name}</button>`
  ).join('');
  chipsHtml += `<button type="button" class="equip-chip equip-chip-otro" onclick="addEquipment('otro')">+ Otro...</button>`;

  section.innerHTML = `
    <div class="equip-header">
      <span class="equip-header-label">// equipos y hardware</span>
      <span class="equip-header-count" id="equipCount">0 items</span>
    </div>
    <div class="equip-chips">${chipsHtml}</div>
    <div id="equipRows" class="equip-rows"></div>
    <div id="equipSubtotal" class="equip-subtotal" style="display:none"></div>`;
}

function addEquipment(catalogId) {
  const uid = ++equipUidCounter;
  let item;
  if (catalogId === 'otro') {
    item = { uid, catalogId: 'otro', name: '', qty: 1, unitPrice: 0 };
  } else {
    const cat = EQUIP_CATALOG.find(c => c.id === catalogId);
    item = { uid, catalogId, name: cat.name, qty: 1, unitPrice: cat.defaultPrice };
  }
  equipmentItems.push(item);
  renderEquipRows();
  updateSummary();
}

function removeEquipment(uid) {
  equipmentItems = equipmentItems.filter(e => e.uid !== uid);
  renderEquipRows();
  updateSummary();
}

function updateEquipField(uid, field, value) {
  const item = equipmentItems.find(e => e.uid === uid);
  if (!item) return;
  if (field === 'qty')       item.qty = Math.max(1, parseInt(value) || 1);
  if (field === 'unitPrice') item.unitPrice = Math.max(0, parseFloat(value) || 0);
  if (field === 'name')      item.name = value;
  updateSummary();
}

function renderEquipRows() {
  const container = document.getElementById('equipRows');
  if (!container) return;

  container.innerHTML = equipmentItems.map(item => {
    const cat = EQUIP_CATALOG.find(c => c.id === item.catalogId);
    const icon = cat ? cat.icon : '📦';
    const lineTotal = item.qty * item.unitPrice;
    return `
      <div class="equip-row">
        <span class="equip-row-icon">${icon}</span>
        <input type="text" class="equip-row-name" value="${item.name}"
          placeholder="Descripción del equipo"
          oninput="updateEquipField(${item.uid},'name',this.value)" />
        <div class="equip-row-qty">
          <button type="button" onclick="adjustEquipQty(${item.uid},-1)">−</button>
          <input type="number" value="${item.qty}" min="1" max="999"
            oninput="updateEquipField(${item.uid},'qty',this.value)" />
          <button type="button" onclick="adjustEquipQty(${item.uid},1)">+</button>
        </div>
        <div class="equip-row-price">
          <span class="svc-rate-prefix">$</span>
          <input type="number" value="${item.unitPrice}" min="0"
            oninput="updateEquipField(${item.uid},'unitPrice',this.value)" />
        </div>
        <span class="equip-row-total">${fmt(lineTotal)}</span>
        <button type="button" class="equip-row-remove" onclick="removeEquipment(${item.uid})">✕</button>
      </div>`;
  }).join('');

  const countEl = document.getElementById('equipCount');
  if (countEl) countEl.textContent = `${equipmentItems.length} item${equipmentItems.length !== 1 ? 's' : ''}`;
}

function adjustEquipQty(uid, delta) {
  const item = equipmentItems.find(e => e.uid === uid);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  renderEquipRows();
  updateSummary();
}

function calcEquipTotal() {
  return equipmentItems.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);
}

// ─────────────────────────────────────────
// UPDATE SUMMARY (TERMINAL)
// ─────────────────────────────────────────
function updateSummary() {
  const termItems     = document.getElementById('termItems');
  const termSep       = document.getElementById('termSep');
  const termTotRow    = document.getElementById('termTotalRow');
  const termIvaRow    = document.getElementById('termIvaRow');
  const termTotal     = document.getElementById('termTotal');
  const termIva       = document.getElementById('termIva');
  const termTotLabel  = document.getElementById('termTotalLabel');
  const termFolio     = document.getElementById('termFolio');
  const termUnicoRow  = document.getElementById('termUnicoRow');
  const termUnicoAmt  = document.getElementById('termUnicoAmt');
  const termUnicoIvaR = document.getElementById('termUnicoIvaRow');
  const termUnicoIva  = document.getElementById('termUnicoIva');
  const termDiscRow   = document.getElementById('termDiscountRow');
  const termDiscAmt   = document.getElementById('termDiscountAmt');

  const equipTotal = calcEquipTotal();
  const hasEquip   = equipmentItems.length > 0;
  const descPct    = getDescuento();

  const equipSubEl = document.getElementById('equipSubtotal');
  if (equipSubEl) {
    equipSubEl.style.display = hasEquip ? 'flex' : 'none';
    if (hasEquip) equipSubEl.innerHTML = `<span>Subtotal equipos:</span><span class="equip-subtotal-amount">${fmt(equipTotal)}</span>`;
  }

  const hasActive = activeModules.size > 0;

  if (!hasActive && !hasEquip) {
    if (termItems)    termItems.innerHTML = '<div class="t-line t-info">// Sin servicios activos</div>';
    [termSep, termTotRow, termIvaRow, termUnicoRow, termUnicoIvaR, termFolio, termDiscRow].forEach(el => {
      if (el) el.style.display = 'none';
    });
    prevTotalMensual = 0;
    prevTotalUnico   = 0;
    return;
  }

  let rawMensual = 0;
  let rawUnico   = 0;
  let html = '';

  activeModules.forEach(id => {
    const svc  = SERVICES.find(s => s.id === id);
    const calc = calcSvc(id);
    document.getElementById('csub_' + id).textContent = fmt(calc.total);

    if (calc.mode === 'mensual') {
      rawMensual += calc.total;
      html += `<div class="t-item">
        <span class="t-item-name">+ ${svc.icon} ${svc.name.toLowerCase()} ×${calc.qty} <span class="t-mode-tag">mensual</span></span>
        <span class="t-item-amount">${fmt(calc.total)}</span>
      </div>`;
    } else if (calc.mode === 'hora') {
      rawUnico += calc.total;
      html += `<div class="t-item">
        <span class="t-item-name">+ ${svc.icon} ${svc.name.toLowerCase()} ${calc.hours}h <span class="t-mode-tag t-mode-unico">hora</span></span>
        <span class="t-item-amount">${fmt(calc.total)}</span>
      </div>`;
    } else if (calc.mode === 'proyecto') {
      rawUnico += calc.total;
      html += `<div class="t-item">
        <span class="t-item-name">+ ${svc.icon} ${svc.name.toLowerCase()} <span class="t-mode-tag t-mode-unico">proy</span></span>
        <span class="t-item-amount">${fmt(calc.total)}</span>
      </div>`;
    }
  });

  if (hasEquip) {
    html += '<div class="t-item t-equip-header"><span class="t-item-name">── equipos ──</span></div>';
    equipmentItems.forEach(item => {
      const cat  = EQUIP_CATALOG.find(c => c.id === item.catalogId);
      const icon = cat ? cat.icon : '📦';
      const lt   = item.qty * item.unitPrice;
      rawUnico  += lt;
      html += `<div class="t-item">
        <span class="t-item-name">+ ${icon} ${item.name || 'Equipo'} ×${item.qty} <span class="t-mode-tag t-mode-unico">equipo</span></span>
        <span class="t-item-amount">${fmt(lt)}</span>
      </div>`;
    });
  }

  if (termItems) termItems.innerHTML = html;
  if (termSep)   termSep.style.display = 'block';

  // Aplicar descuento
  const discMensual = rawMensual * descPct / 100;
  const discUnico   = rawUnico   * descPct / 100;
  const grandMensual = rawMensual - discMensual;
  const grandUnico   = rawUnico   - discUnico;

  const hasDiscount = descPct > 0;
  if (termDiscRow) {
    termDiscRow.style.display = (hasDiscount && (rawMensual + rawUnico) > 0) ? 'flex' : 'none';
    if (termDiscAmt) {
      const totalDisc = discMensual + discUnico;
      termDiscAmt.textContent = `-${fmt(totalDisc)} (${descPct}%)`;
    }
  }

  const hasMensual = grandMensual > 0;
  if (termTotRow)  termTotRow.style.display  = hasMensual ? 'flex' : 'none';
  if (termIvaRow)  termIvaRow.style.display  = hasMensual ? 'flex' : 'none';
  if (hasMensual) {
    if (termTotLabel) termTotLabel.innerHTML = 'TOTAL/MES <span class="t-noiva">(sin IVA)</span>';
    animateCount(termTotal, prevTotalMensual, grandMensual);
    prevTotalMensual = grandMensual;
    if (termIva) termIva.textContent = fmt(Math.round(grandMensual * 1.16));
  }

  const hasUnico = grandUnico > 0;
  if (termUnicoRow)  termUnicoRow.style.display  = hasUnico ? 'flex' : 'none';
  if (termUnicoIvaR) termUnicoIvaR.style.display = hasUnico ? 'flex' : 'none';
  if (hasUnico && termUnicoAmt) {
    animateCount(termUnicoAmt, prevTotalUnico, grandUnico);
    prevTotalUnico = grandUnico;
    if (termUnicoIva) termUnicoIva.textContent = fmt(Math.round(grandUnico * 1.16));
  }

  if (termFolio) {
    termFolio.textContent = currentFolio ? `FOLIO: ${currentFolio}` : '';
    termFolio.style.display = currentFolio ? 'block' : 'none';
  }
}

// ─────────────────────────────────────────
// ANIMACIÓN CONTADOR
// ─────────────────────────────────────────
function animateCount(el, from, to, ms = 500) {
  const start = performance.now();
  const diff  = to - from;
  function tick(now) {
    const p = Math.min((now - start) / ms, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(Math.round(from + diff * e));
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function typeTerminalLine() {
  const body = document.getElementById('terminalBody');
  if (!body) return;
  body.style.transition = 'background .1s';
  body.style.background = 'rgba(56,216,78,0.04)';
  setTimeout(() => { body.style.background = ''; }, 200);
}

// ─────────────────────────────────────────
// EXPORT: WHATSAPP
// ─────────────────────────────────────────
function exportWhatsApp() {
  if (!assertAny()) return;

  const empresa   = val('empresa')  || '—';
  const contacto  = val('contacto') || '—';
  const notas     = val('notas');
  const condPago  = val('condPago');
  const descPct   = getDescuento();
  const fecha     = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  const user      = getCurrentUser();

  const vigDias = parseInt(document.getElementById('vigenciaDias')?.value || '30') || 30;
  const vigDate = new Date();
  vigDate.setDate(vigDate.getDate() + vigDias);
  const vigStr  = vigDate.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

  let rawMensual = 0, rawUnico = 0;
  let linesMensual = '', linesUnico = '';

  activeModules.forEach(id => {
    const svc  = SERVICES.find(s => s.id === id);
    const calc = calcSvc(id);
    if (calc.mode === 'mensual') {
      rawMensual += calc.total;
      const p = calc.qty !== 1 ? 's' : '';
      linesMensual += `\n✅ *${svc.name} — ${svc.sub}*\n`;
      if (calc.base > 0) linesMensual += `   • Base mensual: ${fmt(calc.base)}\n`;
      linesMensual += `   • ${calc.qty} ${calc.varUnit}${p} × ${fmt(calc.varRate)}: ${fmt(calc.variable)}\n`;
      linesMensual += `   • *Subtotal: ${fmt(calc.total)}/mes*\n`;
    } else if (calc.mode === 'hora') {
      rawUnico += calc.total;
      linesUnico += `\n⚡ *${svc.name} — Por hora*\n`;
      linesUnico += `   • ${calc.hours} hrs × ${fmt(calc.hourlyRate)}/hr\n`;
      linesUnico += `   • *Subtotal: ${fmt(calc.total)}*\n`;
    } else if (calc.mode === 'proyecto') {
      rawUnico += calc.total;
      linesUnico += `\n🔧 *${svc.name} — Proyecto*\n`;
      linesUnico += `   • *Monto: ${fmt(calc.total)}*\n`;
    }
  });

  let linesEquip = '';
  equipmentItems.forEach(item => {
    const cat = EQUIP_CATALOG.find(c => c.id === item.catalogId);
    const icon = cat ? cat.icon : '📦';
    const lt   = item.qty * item.unitPrice;
    rawUnico  += lt;
    linesEquip += `\n${icon} ${item.name || 'Equipo'} ×${item.qty} = ${fmt(lt)}`;
  });

  const discMensual    = rawMensual * descPct / 100;
  const discUnico      = rawUnico   * descPct / 100;
  const totalMensual   = rawMensual - discMensual;
  const totalUnico     = rawUnico   - discUnico;

  const folioLine    = currentFolio ? `\n📋 Folio: ${currentFolio}` : '';
  const vendedorLine = user ? `\n👨‍💼 Vendedor: ${user.name} (${user.id})` : '';

  let text = `🔧 *PROPUESTA MIRMIBUG IT SOLUTIONS*\n📅 ${fecha}\n🏢 ${empresa}\n👤 ${contacto}${vendedorLine}${folioLine}\n`;

  if (linesMensual) text += `\n*─── SERVICIOS MENSUALES ───*${linesMensual}`;
  if (linesUnico)   text += `\n*─── SERVICIOS ÚNICOS ───*${linesUnico}`;
  if (linesEquip)   text += `\n*─── EQUIPOS ───*${linesEquip}\n`;

  text += `\n━━━━━━━━━━━━━━━━━━━`;
  if (descPct > 0) text += `\n🏷️ Descuento aplicado: ${descPct}%`;
  if (totalMensual > 0) {
    text += `\n💰 *MENSUAL: ${fmt(totalMensual)} MXN*`;
    text += `\n💼 *Con IVA (16%): ${fmt(Math.round(totalMensual * 1.16))} MXN*`;
  }
  if (totalUnico > 0) {
    text += `\n💰 *ÚNICO: ${fmt(totalUnico)} MXN*`;
    text += `\n💼 *Con IVA (16%): ${fmt(Math.round(totalUnico * 1.16))} MXN*`;
  }
  text += `\n━━━━━━━━━━━━━━━━━━━`;
  if (condPago) text += `\n💳 Condiciones de pago: ${condPago}`;
  if (notas)    text += `\n\n📝 ${notas}`;
  text += `\n\n📅 Válida hasta: ${vigStr}`;
  text += `\n\n📞 Mirmibug IT Solutions\n✉️ contacto@mirmibug.com\n🌐 mirmibug.com`;

  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}

// ─────────────────────────────────────────
// EXPORT: GUARDAR Y COMPARTIR
// ─────────────────────────────────────────
async function saveAndShare() {
  if (!assertAny()) return;

  const resultEl = document.getElementById('shareResult');
  resultEl.style.display = 'block';
  resultEl.textContent   = '// guardando propuesta...';

  try {
    const res  = await fetch('/api/save-quote.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(buildQuoteData())
    });
    const data = await res.json();

    if (data.ok) {
      if (data.folio) currentFolio = data.folio;
      const url = `${location.origin}/cotizador-ventas.html?propuesta=${data.token}`;
      const folioHtml = data.folio ? `<div class="cv-share-folio">// FOLIO: ${data.folio}</div>` : '';
      resultEl.innerHTML = `
        ${folioHtml}
        <div class="cv-share-url">
          <input type="text" id="shareUrl" value="${url}" readonly />
          <button type="button" onclick="copyShareUrl()">COPIAR</button>
        </div>
        <span class="cv-share-hint">// link válido ${val('vigenciaDias') || 30} días</span>`;
      updateSummary();
    } else {
      resultEl.textContent = '// error al guardar';
    }
  } catch {
    resultEl.textContent = '// sin conexión al servidor';
  }
}

function copyShareUrl() {
  const input = document.getElementById('shareUrl');
  navigator.clipboard.writeText(input.value).then(() => {
    const btn = input.nextElementSibling;
    const orig = btn.textContent;
    btn.textContent = '✓ OK';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  });
}

// ─────────────────────────────────────────
// EXPORT: EMAIL
// ─────────────────────────────────────────
function sendEmail() {
  if (!assertAny()) return;

  const emailCliente = val('emailCliente');
  if (!emailCliente) {
    alert('Ingresa el email del cliente primero.');
    document.getElementById('emailCliente').focus();
    return;
  }

  const q           = buildQuoteData();
  const summary     = q.items.map(i => `${i.name} (${i.mode}): ${fmt(i.total)}`).join('\n');
  const equipSum    = q.equipment.map(e => `${e.name} ×${e.qty}: ${fmt(e.lineTotal)}`).join('\n');
  const folioNote   = currentFolio ? `\nFolio: ${currentFolio}` : '';
  const descNote    = q.descuento_pct > 0 ? `\nDescuento aplicado: ${q.descuento_pct}%` : '';
  const condNote    = q.condiciones_pago ? `\nCondiciones de pago: ${q.condiciones_pago}` : '';

  let body = `Propuesta IT Mirmibug:${folioNote}\n\n${summary}`;
  if (equipSum) body += `\n\nEquipos:\n${equipSum}`;
  if (q.total_mensual > 0) body += `\n\nTOTAL MENSUAL: ${fmt(q.total_mensual)} MXN (sin IVA) — Con IVA: ${fmt(Math.round(q.total_mensual * 1.16))} MXN`;
  if (q.total_unico   > 0) body += `\nTOTAL ÚNICO: ${fmt(q.total_unico)} MXN (sin IVA) — Con IVA: ${fmt(Math.round(q.total_unico * 1.16))} MXN`;
  body += descNote + condNote;

  const fd = new FormData();
  fd.append('nombre',         q.contacto || 'Prospecto');
  fd.append('email',          emailCliente);
  fd.append('empresa',        q.empresa || '');
  fd.append('mensaje',        body);
  fd.append('origen',         'cotizador-ventas');
  fd.append('quote_summary',  summary);
  fd.append('consentimiento', '1');

  fetch('/api/contact.php', { method: 'POST', body: fd })
    .then(r => r.json())
    .then(d => {
      if (d.ok) alert(`✅ Propuesta enviada a ${emailCliente}`);
      else      alert('Error al enviar: ' + (d.error || 'intenta de nuevo'));
    })
    .catch(() => alert('Error de conexión.'));
}

// ─────────────────────────────────────────
// BUILD QUOTE DATA
// ─────────────────────────────────────────
function buildQuoteData() {
  let rawMensual = 0, rawUnico = 0;
  const items = [];
  const user  = getCurrentUser();
  const descPct = getDescuento();

  activeModules.forEach(id => {
    const svc  = SERVICES.find(s => s.id === id);
    const calc = calcSvc(id);
    const item = { id, name: svc.name, icon: svc.icon, sub: svc.sub, mode: calc.mode, total: calc.total, desc: svc.desc };

    if (calc.mode === 'mensual') {
      rawMensual += calc.total;
      item.base = calc.base; item.qty = calc.qty; item.varUnit = calc.varUnit;
      item.varRate = calc.varRate; item.variable = calc.variable;
    } else if (calc.mode === 'hora') {
      rawUnico += calc.total;
      item.hours = calc.hours; item.hourlyRate = calc.hourlyRate;
    } else if (calc.mode === 'proyecto') {
      rawUnico += calc.total;
    }
    items.push(item);
  });

  const equipment = equipmentItems.map(item => {
    const lt = item.qty * item.unitPrice;
    rawUnico += lt;
    return { catalogId: item.catalogId, name: item.name, qty: item.qty, unitPrice: item.unitPrice, lineTotal: lt };
  });

  const discMensual  = rawMensual * descPct / 100;
  const discUnico    = rawUnico   * descPct / 100;
  const totalMensual = rawMensual - discMensual;
  const totalUnico   = rawUnico   - discUnico;

  const vigDias = parseInt(document.getElementById('vigenciaDias')?.value || '30') || 30;

  return {
    empresa:          val('empresa'),
    contacto:         val('contacto'),
    email:            val('emailCliente'),
    rfc_cliente:      val('rfcCliente'),
    vendedor:         val('vendedor'),
    vendedor_id:      user?.id || '',
    notas:            val('notas'),
    condiciones_pago: val('condPago'),
    vigencia_dias:    vigDias,
    descuento_pct:    descPct,
    fecha:            new Date().toISOString().split('T')[0],
    items,
    equipment,
    raw_mensual:      rawMensual,
    raw_unico:        rawUnico,
    total_mensual:    totalMensual,
    total_unico:      totalUnico,
    total:            totalMensual + totalUnico,
  };
}

// ─────────────────────────────────────────
// LOAD SHARED QUOTE
// ─────────────────────────────────────────
async function loadSharedQuote(token) {
  try {
    const res  = await fetch(`/api/get-quote.php?token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (!data.ok) return;

    const q = data.quote;
    if (q.empresa)          document.getElementById('empresa').value          = q.empresa;
    if (q.contacto)         document.getElementById('contacto').value         = q.contacto;
    if (q.email)            document.getElementById('emailCliente').value      = q.email;
    if (q.rfc_cliente)      document.getElementById('rfcCliente').value        = q.rfc_cliente;
    if (q.notas)            document.getElementById('notas').value             = q.notas;
    if (q.condiciones_pago) document.getElementById('condPago').value          = q.condiciones_pago;
    if (q.vigencia_dias)    document.getElementById('vigenciaDias').value      = q.vigencia_dias;
    if (q.descuento_pct)    document.getElementById('descuentoPct').value      = q.descuento_pct;

    if (q.folio) {
      currentFolio = q.folio;
      const resultEl = document.getElementById('shareResult');
      resultEl.style.display = 'block';
      resultEl.innerHTML = `<div class="cv-share-folio">// FOLIO: ${q.folio}</div>`;
    }

    if (q.items) {
      q.items.forEach(item => {
        if (!activeModules.has(item.id)) activateModule(item.id);
        const mode = item.mode || 'mensual';
        setMode(item.id, mode);
        if (mode === 'mensual') {
          const inp = document.getElementById('qty_' + item.id);
          if (inp) inp.value = item.qty || item.defaultQty;
        } else if (mode === 'hora') {
          const hrsInp  = document.getElementById('hrs_' + item.id);
          const rateInp = document.getElementById('rate_' + item.id);
          if (hrsInp)  hrsInp.value  = item.hours || 10;
          if (rateInp) rateInp.value = item.hourlyRate || 750;
        } else if (mode === 'proyecto') {
          const projInp = document.getElementById('proj_' + item.id);
          if (projInp) projInp.value = item.total || 0;
        }
      });
    }

    if (q.equipment && Array.isArray(q.equipment)) {
      q.equipment.forEach(eq => {
        const uid = ++equipUidCounter;
        equipmentItems.push({ uid, catalogId: eq.catalogId || 'otro', name: eq.name || '', qty: eq.qty || 1, unitPrice: eq.unitPrice || 0 });
      });
      renderEquipRows();
    }

    updateSummary();
  } catch { console.warn('No se pudo cargar la propuesta.'); }
}

// ─────────────────────────────────────────
// PRINT / PDF — TEMPLATE PROFESIONAL
// ─────────────────────────────────────────
function triggerPrint() {
  if (!assertAny()) return;
  buildPrintView();
  window.print();
}

function buildPrintView() {
  const q    = buildQuoteData();
  if (q.items.length === 0 && q.equipment.length === 0) return;

  const user = getCurrentUser();
  const cfg  = companyConfig;

  const fecha    = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  const vigDias  = q.vigencia_dias || 30;
  const vigDate  = new Date();
  vigDate.setDate(vigDate.getDate() + vigDias);
  const vigStr   = vigDate.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

  // ── Filas de tabla ──
  const tableHead = `
    <thead>
      <tr style="background:#38d84e;color:#000">
        <th style="padding:9px 10px;text-align:left;font-size:11px">Servicio</th>
        <th style="padding:9px 10px;text-align:left;font-size:11px">Descripción</th>
        <th style="padding:9px 10px;text-align:right;font-size:11px">Base</th>
        <th style="padding:9px 10px;text-align:center;font-size:11px">Cantidad</th>
        <th style="padding:9px 10px;text-align:right;font-size:11px">P. Unit.</th>
        <th style="padding:9px 10px;text-align:right;font-size:11px">Subtotal</th>
      </tr>
    </thead>`;

  function tdCell(content, align = 'left', bold = false) {
    return `<td style="padding:9px 10px;border-bottom:1px solid #eee;text-align:${align};font-size:11px;${bold ? 'font-weight:700;color:#38d84e' : 'color:#333'}">${content}</td>`;
  }

  let mensualRows = '';
  q.items.filter(i => i.mode === 'mensual').forEach(item => {
    const p = (item.qty || 0) !== 1 ? 's' : '';
    mensualRows += `<tr>
      ${tdCell(`<b>${item.icon} ${item.name}</b>`)}
      ${tdCell(`<span style="color:#666;font-size:10px">${item.desc}</span>`)}
      ${tdCell((item.base || 0) > 0 ? fmt(item.base) : '—', 'right')}
      ${tdCell(`${item.qty} ${item.varUnit}${p}`, 'center')}
      ${tdCell(fmt(item.varRate), 'right')}
      ${tdCell(fmt(item.total), 'right', true)}
    </tr>`;
  });

  let unicoRows = '';
  q.items.filter(i => i.mode !== 'mensual').forEach(item => {
    const qtyCol  = item.mode === 'hora' ? `${item.hours} hrs` : 'Proyecto';
    const unitCol = item.mode === 'hora' ? fmt(item.hourlyRate) + '/hr' : '—';
    unicoRows += `<tr>
      ${tdCell(`<b>${item.icon} ${item.name}</b>`)}
      ${tdCell(`<span style="color:#666;font-size:10px">${item.desc}</span>`)}
      ${tdCell('—', 'right')}
      ${tdCell(qtyCol, 'center')}
      ${tdCell(unitCol, 'right')}
      ${tdCell(fmt(item.total), 'right', true)}
    </tr>`;
  });

  let equipRows = '';
  q.equipment.forEach(eq => {
    const cat  = EQUIP_CATALOG.find(c => c.id === eq.catalogId);
    const icon = cat ? cat.icon : '📦';
    equipRows += `<tr>
      ${tdCell(`<b>${icon} ${eq.name || 'Equipo'}</b>`)}
      ${tdCell('<span style="color:#666;font-size:10px">Hardware / Equipamiento</span>')}
      ${tdCell('—', 'right')}
      ${tdCell(String(eq.qty), 'center')}
      ${tdCell(fmt(eq.unitPrice), 'right')}
      ${tdCell(fmt(eq.lineTotal), 'right', true)}
    </tr>`;
  });

  function buildSection(label, rows) {
    if (!rows) return '';
    return `
      <div style="font-size:10px;font-weight:800;color:#38d84e;letter-spacing:2px;margin:18px 0 6px;text-transform:uppercase;border-left:3px solid #38d84e;padding-left:8px">${label}</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:4px">${tableHead}<tbody>${rows}</tbody></table>`;
  }

  let tablesHtml = '';
  if (mensualRows) tablesHtml += buildSection('Servicios Recurrentes — Mensual', mensualRows);
  if (unicoRows)   tablesHtml += buildSection('Servicios por Hora / Proyecto', unicoRows);
  if (equipRows)   tablesHtml += buildSection('Equipos / Hardware', equipRows);

  // ── Totales ──
  const hasMensual = q.total_mensual > 0;
  const hasUnico   = q.total_unico   > 0;
  const descPct    = q.descuento_pct || 0;

  function totalBox(label, subtotal, descuento, total, color) {
    const discRow = descuento > 0
      ? `<div style="font-size:11px;color:#e53935;margin:4px 0">Descuento (${descPct}%): -${fmt(descuento)}</div>`
      : '';
    return `
      <div style="text-align:right;background:#fafafa;padding:14px 20px;border-radius:6px;border-left:4px solid ${color};min-width:220px">
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">${label}</div>
        ${descuento > 0 ? `<div style="font-size:12px;color:#aaa;margin-bottom:2px">Subtotal: ${fmt(subtotal)}</div>` : ''}
        ${discRow}
        <div style="font-size:22px;font-weight:900;color:${color}">${fmt(total)} MXN</div>
        <div style="font-size:11px;color:#777;margin-top:4px">+ IVA 16%: <b>${fmt(Math.round(total * 1.16))} MXN</b></div>
      </div>`;
  }

  let totalsHtml = '<div style="display:flex;justify-content:flex-end;gap:12px;margin:20px 0;flex-wrap:wrap">';
  if (hasMensual) {
    totalsHtml += totalBox('Total Mensual (sin IVA)', q.raw_mensual, q.raw_mensual * descPct / 100, q.total_mensual, '#38d84e');
  }
  if (hasUnico) {
    totalsHtml += totalBox('Total Único (sin IVA)', q.raw_unico, q.raw_unico * descPct / 100, q.total_unico, '#2196F3');
  }
  totalsHtml += '</div>';

  // ── Condiciones de pago ──
  const condPago      = q.condiciones_pago;
  const clabe         = cfg.clabe         || '';
  const bank          = cfg.bank          || '';
  const bankTitular   = cfg.bank_titular  || 'Mirmibug IT Solutions';
  let paymentHtml = '';
  if (condPago || clabe || bank) {
    paymentHtml = `
      <div style="background:#f0fdf4;border:1px solid #c6f6d5;border-radius:6px;padding:12px 16px;margin-bottom:16px">
        <div style="font-size:10px;font-weight:800;color:#38d84e;letter-spacing:2px;margin-bottom:8px;text-transform:uppercase">Condiciones de Pago</div>
        ${condPago   ? `<div style="font-size:12px;margin-bottom:4px"><b>Forma:</b> ${condPago}</div>` : ''}
        ${clabe      ? `<div style="font-size:12px;margin-bottom:2px"><b>CLABE:</b> ${clabe}</div>` : ''}
        ${bank       ? `<div style="font-size:12px;margin-bottom:2px"><b>Banco:</b> ${bank}</div>` : ''}
        ${bankTitular ? `<div style="font-size:12px"><b>Titular:</b> ${bankTitular}</div>` : ''}
      </div>`;
  }

  // ── Notas ──
  const notasHtml = q.notas
    ? `<div style="padding:10px 14px;border:1px solid #ddd;border-radius:6px;font-size:11px;color:#444;margin-bottom:16px"><b>Notas y condiciones especiales:</b><br>${q.notas}</div>`
    : '';

  // ── Footer términos ──
  const terms = cfg.terms || 'Precios en MXN sin IVA. IVA aplicable 16%. Contrato mensual sin permanencia mínima.';

  // ── RFC y datos empresa ──
  const rfc     = cfg.rfc     || '';
  const address = cfg.address || 'Ciudad de México';
  const phone   = cfg.phone   || '';

  // ── Construir HTML completo ──
  const logoPath = window.location.origin + '/img/mirmibug-logo-green_sfondo.png';

  document.getElementById('printView').innerHTML = `
    <div style="max-width:820px;margin:0 auto;font-family:Inter,Arial,sans-serif;color:#111;padding:28px 32px;font-size:12px">

      <!-- HEADER EMPRESA -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;margin-bottom:20px;border-bottom:3px solid #38d84e">
        <div style="display:flex;align-items:center;gap:14px">
          <img src="${logoPath}" alt="Mirmibug" style="width:52px;height:52px;object-fit:contain" />
          <div>
            <div style="font-size:20px;font-weight:900;color:#38d84e;letter-spacing:1px">MIRMIBUG IT SOLUTIONS</div>
            ${rfc     ? `<div style="font-size:10px;color:#555;margin-top:2px">RFC: <b>${rfc}</b></div>` : ''}
            <div style="font-size:10px;color:#666;margin-top:1px">${address}${phone ? ` · ${phone}` : ''}</div>
            <div style="font-size:10px;color:#666">contacto@mirmibug.com · mirmibug.com</div>
          </div>
        </div>
        <div style="text-align:right;font-size:11px;color:#444;line-height:1.8">
          <div style="font-size:13px;font-weight:800;color:#111;letter-spacing:.5px">PROPUESTA COMERCIAL</div>
          ${currentFolio ? `<div><b>Folio:</b> ${currentFolio}</div>` : ''}
          <div><b>Fecha:</b> ${fecha}</div>
          <div><b>Válida hasta:</b> ${vigStr}</div>
          ${user ? `<div><b>Vendedor:</b> ${user.name} (${user.id})</div>` : ''}
        </div>
      </div>

      <!-- DATOS CLIENTE -->
      <div style="background:#f9f9f9;padding:12px 16px;border-radius:6px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
        <div>
          <div style="font-size:10px;font-weight:800;color:#38d84e;letter-spacing:2px;margin-bottom:6px;text-transform:uppercase">Para</div>
          ${q.empresa  ? `<div style="font-size:14px;font-weight:700">${q.empresa}</div>` : ''}
          ${q.rfc_cliente ? `<div style="font-size:11px;color:#555">RFC: ${q.rfc_cliente}</div>` : ''}
          ${q.contacto ? `<div style="font-size:11px;color:#555;margin-top:2px">Attn: ${q.contacto}</div>` : ''}
          ${q.email    ? `<div style="font-size:11px;color:#555">${q.email}</div>` : ''}
        </div>
        <div style="text-align:right;font-size:11px;color:#555">
          <div style="font-size:10px;font-weight:800;color:#38d84e;letter-spacing:2px;margin-bottom:6px;text-transform:uppercase">Servicios IT Administrados</div>
          <div>Contrato: Mensual sin permanencia</div>
        </div>
      </div>

      <!-- TABLAS -->
      ${tablesHtml}

      <!-- TOTALES -->
      ${totalsHtml}

      <!-- CONDICIONES DE PAGO -->
      ${paymentHtml}

      <!-- NOTAS -->
      ${notasHtml}

      <!-- FIRMA -->
      <div style="display:flex;justify-content:space-between;gap:32px;margin:28px 0 20px;padding-top:20px;border-top:1px solid #eee">
        <div style="flex:1;text-align:center">
          <div style="border-top:1px solid #999;margin-bottom:8px;padding-top:10px;margin-top:40px"></div>
          <div style="font-size:11px;font-weight:700">Autorizado por</div>
          <div style="font-size:10px;color:#666">Mirmibug IT Solutions</div>
          ${user ? `<div style="font-size:10px;color:#888">${user.name}</div>` : ''}
        </div>
        <div style="flex:1;text-align:center">
          <div style="border-top:1px solid #999;margin-bottom:8px;padding-top:10px;margin-top:40px"></div>
          <div style="font-size:11px;font-weight:700">Acepto y apruebo</div>
          <div style="font-size:10px;color:#666">${q.empresa || 'Cliente'}</div>
          ${q.contacto ? `<div style="font-size:10px;color:#888">${q.contacto}</div>` : ''}
        </div>
      </div>

      <!-- FOOTER -->
      <div style="font-size:9px;color:#aaa;border-top:1px solid #eee;padding-top:10px;line-height:1.8">
        ${terms}
        Propuesta válida hasta el ${vigStr}. Consultas: <b>contacto@mirmibug.com</b>
      </div>

    </div>`;
}

// ─────────────────────────────────────────
// HISTORIAL DE COTIZACIONES
// ─────────────────────────────────────────
function openHistorialModal() {
  document.getElementById('historialModal').style.display = 'flex';
  loadHistorial();
}

function closeHistorialModal() {
  document.getElementById('historialModal').style.display = 'none';
}

async function loadHistorial() {
  const listEl = document.getElementById('historialList');
  listEl.innerHTML = '<div class="admin-loading">Cargando historial...</div>';

  if (IS_LOCALHOST) {
    listEl.innerHTML = '<div class="admin-empty">Historial solo disponible en mirmibug.com</div>';
    return;
  }

  try {
    const res  = await fetch('api/quotes.php?action=list', {
      headers: {
        'X-Vendor-Token': getVendorToken(),
        'X-Admin-Token':  getAdminToken(),
      }
    });
    const data = await res.json();

    if (!data.ok) {
      listEl.innerHTML = `<div class="admin-error">Error: ${data.error}</div>`;
      return;
    }

    _allHistorial = data.quotes || [];
    renderHistorial(_allHistorial);
  } catch {
    listEl.innerHTML = '<div class="admin-error">Error de conexión</div>';
  }
}

function filterHistorial() {
  const q = document.getElementById('histSearch')?.value?.toLowerCase().trim() || '';
  if (!q) { renderHistorial(_allHistorial); return; }
  const filtered = _allHistorial.filter(c =>
    (c.folio            || '').toLowerCase().includes(q) ||
    (c.cliente_empresa  || '').toLowerCase().includes(q) ||
    (c.cliente_contacto || '').toLowerCase().includes(q) ||
    (c.vendedor         || '').toLowerCase().includes(q)
  );
  renderHistorial(filtered);
}

function renderHistorial(quotes) {
  const listEl = document.getElementById('historialList');
  if (!quotes || quotes.length === 0) {
    listEl.innerHTML = '<div class="admin-empty">Sin cotizaciones registradas</div>';
    return;
  }

  listEl.innerHTML = quotes.map(q => {
    const fecha    = new Date(q.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    const mensual  = parseFloat(q.total_mensual || 0);
    const unico    = parseFloat(q.total_unico   || 0);
    const expired  = q.expires_at && new Date(q.expires_at) < new Date();

    let totales = '';
    if (mensual > 0) totales += `<span class="hist-badge hist-badge-green">${fmt(mensual)}/mes</span>`;
    if (unico   > 0) totales += `<span class="hist-badge hist-badge-blue">${fmt(unico)} único</span>`;

    return `
      <div class="historial-row ${expired ? 'hist-expired' : ''}">
        <div class="hist-main">
          <div class="hist-empresa">${q.cliente_empresa || '(sin nombre)'}</div>
          <div class="hist-meta">
            ${q.folio ? `<span class="hist-folio">${q.folio}</span>` : ''}
            <span>${fecha}</span>
            ${q.vendedor ? `<span>· ${q.vendedor}</span>` : ''}
            ${expired    ? '<span class="hist-exp-tag">EXPIRADA</span>' : ''}
          </div>
          <div class="hist-totales">${totales}</div>
        </div>
        <div class="hist-actions">
          <button class="admin-action-btn" title="Abrir propuesta" onclick="openSharedQuote('${q.token}')">🔗</button>
          <button class="admin-action-btn" title="Duplicar cotización" onclick="duplicateQuote('${q.token}')">⧉ USAR</button>
        </div>
      </div>`;
  }).join('');
}

function openSharedQuote(token) {
  window.open(`/cotizador-ventas.html?propuesta=${token}`, '_blank');
}

async function duplicateQuote(token) {
  try {
    const res  = await fetch(`/api/get-quote.php?token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (!data.ok) { alert('No se pudo cargar la cotización'); return; }

    closeHistorialModal();

    // Limpiar estado actual
    activeModules.forEach(id => deactivateModule(id));
    equipmentItems = [];
    renderEquipRows();
    currentFolio = null;
    document.getElementById('shareResult').style.display = 'none';

    // Cargar datos (reusar loadSharedQuote sin folio)
    const q = data.quote;
    if (q.empresa)          document.getElementById('empresa').value      = q.empresa;
    if (q.contacto)         document.getElementById('contacto').value     = q.contacto;
    if (q.email)            document.getElementById('emailCliente').value = q.email;
    if (q.rfc_cliente)      document.getElementById('rfcCliente').value   = q.rfc_cliente;
    if (q.notas)            document.getElementById('notas').value        = q.notas;
    if (q.condiciones_pago) document.getElementById('condPago').value     = q.condiciones_pago;
    if (q.vigencia_dias)    document.getElementById('vigenciaDias').value = q.vigencia_dias;
    if (q.descuento_pct)    document.getElementById('descuentoPct').value = q.descuento_pct;

    if (q.items) {
      q.items.forEach(item => {
        if (!activeModules.has(item.id)) activateModule(item.id);
        const mode = item.mode || 'mensual';
        setMode(item.id, mode);
        if (mode === 'mensual') {
          const inp = document.getElementById('qty_' + item.id);
          if (inp) inp.value = item.qty;
        } else if (mode === 'hora') {
          const hrsInp  = document.getElementById('hrs_'  + item.id);
          const rateInp = document.getElementById('rate_' + item.id);
          if (hrsInp)  hrsInp.value  = item.hours;
          if (rateInp) rateInp.value = item.hourlyRate;
        } else if (mode === 'proyecto') {
          const projInp = document.getElementById('proj_' + item.id);
          if (projInp) projInp.value = item.total;
        }
      });
    }
    if (q.equipment && Array.isArray(q.equipment)) {
      q.equipment.forEach(eq => {
        const uid = ++equipUidCounter;
        equipmentItems.push({ uid, catalogId: eq.catalogId || 'otro', name: eq.name || '', qty: eq.qty || 1, unitPrice: eq.unitPrice || 0 });
      });
      renderEquipRows();
    }
    updateSummary();
  } catch { alert('Error de conexión'); }
}

// ─────────────────────────────────────────
// ADMIN PANEL
// ─────────────────────────────────────────
function openAdminPanel() {
  document.getElementById('adminPanel').style.display = 'flex';
  switchAdminTab('vendors');
}

function closeAdminPanel() {
  document.getElementById('adminPanel').style.display = 'none';
}

function switchAdminTab(tab) {
  ['vendors', 'precios', 'empresa'].forEach(t => {
    const btn     = document.getElementById(`tab-btn-${t}`);
    const content = document.getElementById(`adminTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (btn)     btn.classList.toggle('active', t === tab);
    if (content) content.style.display = (t === tab) ? 'block' : 'none';
  });

  if (tab === 'vendors') loadVendors();
  if (tab === 'precios') loadPricesTab();
  if (tab === 'empresa') loadCompanyTab();
}

// ── ADMIN: VENDEDORES ──

async function adminFetch(action, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': getAdminToken() }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}?action=${action}`, opts);
  if (res.status === 403) throw new Error('SESSION_EXPIRED');
  return res.json();
}

async function loadVendors() {
  const list = document.getElementById('vendorList');
  list.innerHTML = '<div class="admin-loading">Cargando...</div>';

  if (IS_LOCALHOST) {
    const currentUser = getCurrentUser();
    list.innerHTML = LOCAL_DEV_USERS.map(v => {
      const roleTag = v.role === 'admin' ? '<span class="admin-role-tag">ADMIN</span>' : '';
      return `<div class="admin-row">
        <div class="admin-row-info">
          <span class="admin-row-id">${v.id}</span>
          <span class="admin-row-name">${v.name}</span>
          ${roleTag}
          <span class="admin-status-active">ACTIVO</span>
        </div>
        <div class="admin-row-actions"><span style="color:var(--accent);font-size:.7rem;opacity:.6">modo local</span></div>
      </div>`;
    }).join('') + '<div class="admin-empty" style="margin-top:8px">Gestión completa solo en mirmibug.com</div>';
    return;
  }

  try {
    const data = await adminFetch('list');
    if (!data.ok) { list.innerHTML = `<div class="admin-error">Error: ${data.error}</div>`; return; }
    if (data.vendors.length === 0) { list.innerHTML = '<div class="admin-empty">No hay vendedores</div>'; return; }

    const currentUser = getCurrentUser();
    list.innerHTML = data.vendors.map(v => {
      const isSelf      = v.vendor_id === currentUser?.id;
      const statusClass = v.active == 1 ? 'admin-status-active' : 'admin-status-inactive';
      const roleTag     = v.role === 'admin' ? '<span class="admin-role-tag">ADMIN</span>' : '';
      return `<div class="admin-row ${v.active == 1 ? '' : 'admin-row-inactive'}">
        <div class="admin-row-info">
          <span class="admin-row-id">${v.vendor_id}</span>
          <span class="admin-row-name">${v.name}</span>
          ${roleTag}
          <span class="${statusClass}">${v.active == 1 ? 'ACTIVO' : 'INACTIVO'}</span>
        </div>
        <div class="admin-row-actions">
          <button onclick="promptChangePin('${v.vendor_id}','${v.name}')" class="admin-action-btn" title="Cambiar PIN">🔑</button>
          ${!isSelf ? `<button onclick="toggleVendor('${v.vendor_id}')" class="admin-action-btn" title="${v.active == 1 ? 'Desactivar' : 'Activar'}">${v.active == 1 ? '⏸' : '▶'}</button>` : ''}
          ${!isSelf ? `<button onclick="deleteVendor('${v.vendor_id}','${v.name}')" class="admin-action-btn admin-action-danger" title="Eliminar">🗑</button>` : ''}
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    list.innerHTML = e.message === 'SESSION_EXPIRED'
      ? '<div class="admin-error">Sesión expirada — cierra sesión y vuelve a entrar</div>'
      : '<div class="admin-error">Error de conexión con el servidor</div>';
  }
}

async function createVendor() {
  if (IS_LOCALHOST) { alert('Gestión de vendedores solo disponible en mirmibug.com'); return; }
  const nameInput = document.getElementById('newVendorName');
  const pinInput  = document.getElementById('newVendorPin');
  const name = nameInput.value.trim(), pin = pinInput.value.trim();
  if (!name || !pin) { alert('Nombre y PIN son requeridos'); return; }
  if (pin.length < 4) { alert('El PIN debe tener al menos 4 caracteres'); return; }
  try {
    const data = await adminFetch('create', 'POST', { name, pin });
    if (data.ok) { nameInput.value = ''; pinInput.value = ''; loadVendors(); }
    else alert('Error: ' + (data.error || 'No se pudo crear'));
  } catch (e) { alert(e.message === 'SESSION_EXPIRED' ? 'Sesión expirada' : 'Error de conexión'); }
}

function promptChangePin(vendorId, vendorName) {
  if (IS_LOCALHOST) { alert('Gestión solo disponible en mirmibug.com'); return; }
  const newPin = prompt(`Nuevo PIN para ${vendorName} (${vendorId}):\n(mínimo 4 caracteres)`);
  if (!newPin || newPin.trim().length < 4) { if (newPin !== null) alert('PIN debe tener al menos 4 caracteres'); return; }
  changePin(vendorId, newPin.trim());
}

async function changePin(vendorId, newPin) {
  try {
    const data = await adminFetch('update_pin', 'POST', { vendor_id: vendorId, new_pin: newPin });
    if (data.ok) alert('PIN actualizado correctamente');
    else alert('Error: ' + (data.error || 'No se pudo actualizar'));
  } catch (e) { alert(e.message === 'SESSION_EXPIRED' ? 'Sesión expirada' : 'Error de conexión'); }
}

async function toggleVendor(vendorId) {
  try {
    const data = await adminFetch('toggle', 'POST', { vendor_id: vendorId });
    if (data.ok) loadVendors();
    else alert('Error: ' + (data.error || 'No se pudo cambiar estado'));
  } catch (e) { alert(e.message === 'SESSION_EXPIRED' ? 'Sesión expirada' : 'Error de conexión'); }
}

async function deleteVendor(vendorId, vendorName) {
  if (!confirm(`¿Eliminar a ${vendorName} (${vendorId})?\nEsta acción no se puede deshacer.`)) return;
  try {
    const data = await adminFetch('delete', 'POST', { vendor_id: vendorId });
    if (data.ok) loadVendors();
    else alert('Error: ' + (data.error || 'No se pudo eliminar'));
  } catch (e) { alert(e.message === 'SESSION_EXPIRED' ? 'Sesión expirada' : 'Error de conexión'); }
}

// ── ADMIN: PRECIOS ──

async function loadPricesTab() {
  const priceForm = document.getElementById('priceForm');
  priceForm.innerHTML = '<div class="admin-loading">Cargando precios...</div>';

  let overrides = { services: {}, equip: {} };
  try {
    const res  = await fetch('api/company-config.php?action=get_prices');
    const data = await res.json();
    if (data.ok && data.prices) overrides = data.prices;
  } catch {}

  let html = '<div class="price-section-label">// Servicios</div>';
  html += '<div class="price-grid">';

  SERVICES_DEFAULT.forEach(svc => {
    const ov = overrides.services?.[svc.id] || {};
    const base = ov.base        || svc.base;
    const varR = ov.varRate     || svc.varRate;
    const hrR  = ov.hourlyRate  || svc.hourlyRate;

    html += `
      <div class="price-row">
        <div class="price-row-name">${svc.icon} ${svc.name}</div>
        <div class="price-row-fields">
          <label>Base $<input type="number" class="price-input" data-svc="${svc.id}" data-field="base" value="${base}" min="0" /></label>
          <label>${svc.varUnit}/$ <input type="number" class="price-input" data-svc="${svc.id}" data-field="varRate" value="${varR}" min="0" /></label>
          <label>Hora/$ <input type="number" class="price-input" data-svc="${svc.id}" data-field="hourlyRate" value="${hrR}" min="0" /></label>
        </div>
      </div>`;
  });
  html += '</div>';

  html += '<div class="price-section-label" style="margin-top:16px">// Equipos (precio sugerido)</div>';
  html += '<div class="price-grid">';
  EQUIP_CATALOG_DEFAULT.forEach(eq => {
    const ov      = overrides.equip?.[eq.id] || {};
    const defP    = ov.defaultPrice || eq.defaultPrice;
    html += `
      <div class="price-row">
        <div class="price-row-name">${eq.icon} ${eq.name}</div>
        <div class="price-row-fields">
          <label>Precio $ <input type="number" class="price-input" data-equip="${eq.id}" data-field="defaultPrice" value="${defP}" min="0" /></label>
        </div>
      </div>`;
  });
  html += '</div>';

  priceForm.innerHTML = html;
}

async function savePrices() {
  const btn   = document.querySelector('[onclick="savePrices()"]');
  const msgEl = document.getElementById('priceSaveMsg');

  const payload = { services: {}, equip: {} };

  document.querySelectorAll('.price-input[data-svc]').forEach(inp => {
    const id    = inp.dataset.svc;
    const field = inp.dataset.field;
    if (!payload.services[id]) payload.services[id] = {};
    payload.services[id][field] = parseFloat(inp.value) || 0;
  });
  document.querySelectorAll('.price-input[data-equip]').forEach(inp => {
    const id    = inp.dataset.equip;
    const field = inp.dataset.field;
    if (!payload.equip[id]) payload.equip[id] = {};
    payload.equip[id][field] = parseFloat(inp.value) || 0;
  });

  if (IS_LOCALHOST) {
    applyPriceOverrides(payload);
    if (msgEl) { msgEl.textContent = '✓ Aplicado localmente'; setTimeout(() => { msgEl.textContent = ''; }, 2500); }
    return;
  }

  try {
    btn.disabled = true;
    const res  = await fetch('api/company-config.php?action=save_prices', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': getAdminToken() },
      body:    JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.ok) {
      applyPriceOverrides(payload);
      if (msgEl) { msgEl.textContent = '✓ Precios guardados'; setTimeout(() => { msgEl.textContent = ''; }, 2500); }
    } else {
      if (msgEl) msgEl.textContent = 'Error al guardar';
    }
  } catch { if (msgEl) msgEl.textContent = 'Error de conexión'; }
  finally  { btn.disabled = false; }
}

// ── ADMIN: EMPRESA ──

async function loadCompanyTab() {
  try {
    const res  = await fetch('api/company-config.php?action=get_company');
    const data = await res.json();
    if (!data.ok) return;
    const c = data.config || {};
    const setVal = (id, key) => { const el = document.getElementById(id); if (el && c[key]) el.value = c[key]; };
    setVal('cfg_rfc', 'rfc');
    setVal('cfg_address', 'address');
    setVal('cfg_phone', 'phone');
    setVal('cfg_clabe', 'clabe');
    setVal('cfg_bank', 'bank');
    setVal('cfg_bank_titular', 'bank_titular');
    setVal('cfg_terms', 'terms');
    setVal('cfg_max_discount', 'max_discount');
  } catch {}
}

async function saveCompanyConfig() {
  const btn   = document.querySelector('[onclick="saveCompanyConfig()"]');
  const msgEl = document.getElementById('empresaSaveMsg');

  const payload = {
    rfc:          document.getElementById('cfg_rfc')?.value.trim(),
    address:      document.getElementById('cfg_address')?.value.trim(),
    phone:        document.getElementById('cfg_phone')?.value.trim(),
    clabe:        document.getElementById('cfg_clabe')?.value.trim(),
    bank:         document.getElementById('cfg_bank')?.value.trim(),
    bank_titular: document.getElementById('cfg_bank_titular')?.value.trim(),
    terms:        document.getElementById('cfg_terms')?.value.trim(),
    max_discount: document.getElementById('cfg_max_discount')?.value.trim(),
  };

  if (IS_LOCALHOST) {
    Object.assign(companyConfig, payload);
    if (msgEl) { msgEl.textContent = '✓ Aplicado localmente'; setTimeout(() => { msgEl.textContent = ''; }, 2500); }
    return;
  }

  try {
    btn.disabled = true;
    const res  = await fetch('api/company-config.php?action=save_company', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': getAdminToken() },
      body:    JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.ok) {
      Object.assign(companyConfig, payload);
      if (msgEl) { msgEl.textContent = '✓ Datos guardados'; setTimeout(() => { msgEl.textContent = ''; }, 2500); }
    } else {
      if (msgEl) msgEl.textContent = 'Error al guardar';
    }
  } catch { if (msgEl) msgEl.textContent = 'Error de conexión'; }
  finally  { btn.disabled = false; }
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function assertAny() {
  if (activeModules.size === 0 && equipmentItems.length === 0) {
    alert('Activa al menos un módulo de servicio o agrega un equipo primero.');
    return false;
  }
  return true;
}

// ─────────────────────────────────────────
// ARRANCAR
// ─────────────────────────────────────────
window.addEventListener('DOMContentLoaded', initPin);
