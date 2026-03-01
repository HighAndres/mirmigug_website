/* =========================
   COTIZADOR DE VENTAS — TECH REDESIGN
   Mirmibug IT Solutions · México
   Autenticación server-side (PHP + MySQL)
   Panel admin para gestión de vendedores
========================= */

'use strict';

const API_BASE = 'api/vendors.php';

// ─────────────────────────────────────────
// CATÁLOGO DE SERVICIOS
// ─────────────────────────────────────────
const SERVICES = [
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
const EQUIP_CATALOG = [
  { id: 'laptop',   name: 'Laptop',        icon: '💻', defaultPrice: 18500 },
  { id: 'desktop',  name: 'Desktop',        icon: '🖥️', defaultPrice: 14000 },
  { id: 'server',   name: 'Servidor',       icon: '🗄️', defaultPrice: 45000 },
  { id: 'switch',   name: 'Switch',         icon: '🔌', defaultPrice: 12000 },
  { id: 'firewall', name: 'Firewall',       icon: '🛡️', defaultPrice: 25000 },
  { id: 'ups',      name: 'UPS',            icon: '🔋', defaultPrice: 8000 },
  { id: 'ap',       name: 'Access Point',   icon: '📡', defaultPrice: 6500 },
];

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

// ─────────────────────────────────────────
// USUARIOS: helpers
// ─────────────────────────────────────────
function getCurrentUser() {
  try { return JSON.parse(sessionStorage.getItem('cv_user')); }
  catch { return null; }
}

function getAdminToken() {
  return sessionStorage.getItem('cv_admin') || '';
}

function isAdmin() {
  const u = getCurrentUser();
  return u && u.role === 'admin';
}

function logout() {
  sessionStorage.removeItem('cv_auth');
  sessionStorage.removeItem('cv_user');
  sessionStorage.removeItem('cv_admin');
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
      if (data.admin_token) sessionStorage.setItem('cv_admin', data.admin_token);
      showApp();
    } else {
      const err = document.getElementById('pinError');
      err.style.display = 'block';
      document.getElementById('pinInput').value = '';
      document.getElementById('pinInput').focus();
      setTimeout(() => { err.style.display = 'none'; }, 2500);
    }
  } catch (e) {
    const err = document.getElementById('pinError');
    err.textContent = '⚠ ERROR DE CONEXIÓN';
    err.style.display = 'block';
    setTimeout(() => {
      err.textContent = '⚠ ACCESO DENEGADO';
      err.style.display = 'none';
    }, 3000);
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'INICIAR SESIÓN <span class="pin-arrow">→</span>';
  }
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

  // Mostrar user badge y logout
  const user = getCurrentUser();
  if (user) {
    const badge = document.getElementById('userBadge');
    badge.textContent = `${user.id} // ${user.name}`;
    badge.style.display = 'inline-block';
    document.getElementById('logoutBtn').style.display = 'inline-block';

    // Auto-fill vendedor
    const vendedorInput = document.getElementById('vendedor');
    vendedorInput.value = user.name;
    vendedorInput.readOnly = true;
    vendedorInput.style.opacity = '0.7';
    vendedorInput.style.cursor = 'default';

    // Mostrar botón admin si es admin
    if (user.role === 'admin') {
      document.getElementById('adminBtn').style.display = 'inline-block';
    }
  }

  renderCards();
  renderEquipSection();
  updateSummary();

  const token = new URLSearchParams(window.location.search).get('propuesta');
  if (token) loadSharedQuote(token);

  window.addEventListener('beforeprint', buildPrintView);
}

// ─────────────────────────────────────────
// RENDER SERVICE CARDS
// ─────────────────────────────────────────
function renderCards() {
  const grid = document.getElementById('svcGrid');

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

        <!-- Mode toggle (shown when active) -->
        <div class="svc-mode-toggle" id="mode_${svc.id}">
          <button type="button" class="svc-mode-btn active" data-mode="mensual" onclick="event.stopPropagation();setMode('${svc.id}','mensual')">MENSUAL</button>
          <button type="button" class="svc-mode-btn" data-mode="hora" onclick="event.stopPropagation();setMode('${svc.id}','hora')">HORA</button>
          <button type="button" class="svc-mode-btn" data-mode="proyecto" onclick="event.stopPropagation();setMode('${svc.id}','proyecto')">PROYECTO</button>
        </div>

        <!-- Controls: MENSUAL (default) -->
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

        <!-- Controls: HORA -->
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

        <!-- Controls: PROYECTO -->
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
function getMode(id) {
  return svcModes[id] || 'mensual';
}

function setMode(id, mode) {
  svcModes[id] = mode;

  // Update toggle buttons
  const toggleEl = document.getElementById('mode_' + id);
  toggleEl.querySelectorAll('.svc-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  // Show/hide control panels
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
  card.classList.add('active');
  document.getElementById('stxt_' + id).textContent = 'ON';
  document.getElementById('activeCount').textContent = activeModules.size;

  // Show the correct control panel for current mode
  setMode(id, svcModes[id]);

  updateSummary();
  typeTerminalLine(id);
}

function deactivateModule(id) {
  activeModules.delete(id);
  const card = document.getElementById('card_' + id);
  card.classList.remove('active');
  document.getElementById('stxt_' + id).textContent = 'OFF';
  document.getElementById('csub_' + id).textContent = '';
  document.getElementById('activeCount').textContent = activeModules.size;

  // Hide all control panels
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

  // Update count
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
// UPDATE SUMMARY (TERMINAL) — TOTALES SEPARADOS
// ─────────────────────────────────────────
function updateSummary() {
  const termItems    = document.getElementById('termItems');
  const termSep      = document.getElementById('termSep');
  const termTotRow   = document.getElementById('termTotalRow');
  const termIvaRow   = document.getElementById('termIvaRow');
  const termTotal    = document.getElementById('termTotal');
  const termIva      = document.getElementById('termIva');
  const termTotLabel = document.getElementById('termTotalLabel');
  const termFolio    = document.getElementById('termFolio');

  // ── Separar totales mensuales vs únicos ──
  const termUnicoRow  = document.getElementById('termUnicoRow');
  const termUnicoAmt  = document.getElementById('termUnicoAmt');
  const termUnicoIvaR = document.getElementById('termUnicoIvaRow');
  const termUnicoIva  = document.getElementById('termUnicoIva');

  const equipTotal = calcEquipTotal();
  const hasEquip = equipmentItems.length > 0;

  // Update equip subtotal display
  const equipSubEl = document.getElementById('equipSubtotal');
  if (equipSubEl) {
    if (hasEquip) {
      equipSubEl.style.display = 'flex';
      equipSubEl.innerHTML = `<span>Subtotal equipos:</span><span class="equip-subtotal-amount">${fmt(equipTotal)}</span>`;
    } else {
      equipSubEl.style.display = 'none';
    }
  }

  const hasActive = activeModules.size > 0;

  if (!hasActive && !hasEquip) {
    termItems.innerHTML = '<div class="t-line t-info">// Sin servicios activos</div>';
    termSep.style.display    = 'none';
    termTotRow.style.display = 'none';
    termIvaRow.style.display = 'none';
    if (termUnicoRow)  termUnicoRow.style.display  = 'none';
    if (termUnicoIvaR) termUnicoIvaR.style.display = 'none';
    if (termFolio) termFolio.style.display = 'none';
    prevTotalMensual = 0;
    prevTotalUnico   = 0;
    return;
  }

  let grandMensual = 0;
  let grandUnico   = 0;
  let html = '';

  // ── Servicios ──
  activeModules.forEach(id => {
    const svc  = SERVICES.find(s => s.id === id);
    const calc = calcSvc(id);

    document.getElementById('csub_' + id).textContent = fmt(calc.total);

    if (calc.mode === 'mensual') {
      grandMensual += calc.total;
      html += `
        <div class="t-item">
          <span class="t-item-name">+ ${svc.icon} ${svc.name.toLowerCase()} ×${calc.qty} <span class="t-mode-tag">mensual</span></span>
          <span class="t-item-amount">${fmt(calc.total)}</span>
        </div>`;
    } else if (calc.mode === 'hora') {
      grandUnico += calc.total;
      html += `
        <div class="t-item">
          <span class="t-item-name">+ ${svc.icon} ${svc.name.toLowerCase()} ${calc.hours}h <span class="t-mode-tag t-mode-unico">hora</span></span>
          <span class="t-item-amount">${fmt(calc.total)}</span>
        </div>`;
    } else if (calc.mode === 'proyecto') {
      grandUnico += calc.total;
      html += `
        <div class="t-item">
          <span class="t-item-name">+ ${svc.icon} ${svc.name.toLowerCase()} <span class="t-mode-tag t-mode-unico">proy</span></span>
          <span class="t-item-amount">${fmt(calc.total)}</span>
        </div>`;
    }
  });

  // ── Equipos en terminal ──
  if (hasEquip) {
    html += '<div class="t-item t-equip-header"><span class="t-item-name">── equipos ──</span></div>';
    equipmentItems.forEach(item => {
      const cat = EQUIP_CATALOG.find(c => c.id === item.catalogId);
      const icon = cat ? cat.icon : '📦';
      const lineTotal = item.qty * item.unitPrice;
      grandUnico += lineTotal;
      html += `
        <div class="t-item">
          <span class="t-item-name">+ ${icon} ${item.name || 'Equipo'} ×${item.qty} <span class="t-mode-tag t-mode-unico">equipo</span></span>
          <span class="t-item-amount">${fmt(lineTotal)}</span>
        </div>`;
    });
  }

  termItems.innerHTML = html;
  termSep.style.display = 'block';

  // ── Mensual ──
  const hasMensual = grandMensual > 0;
  termTotRow.style.display = hasMensual ? 'flex' : 'none';
  termIvaRow.style.display = hasMensual ? 'flex' : 'none';

  if (hasMensual) {
    if (termTotLabel) termTotLabel.innerHTML = 'TOTAL/MES <span class="t-noiva">(sin IVA)</span>';
    animateCount(termTotal, prevTotalMensual, grandMensual);
    prevTotalMensual = grandMensual;
    termIva.textContent = fmt(Math.round(grandMensual * 1.16));
  }

  // ── Único ──
  const hasUnico = grandUnico > 0;
  if (termUnicoRow)  termUnicoRow.style.display  = hasUnico ? 'flex' : 'none';
  if (termUnicoIvaR) termUnicoIvaR.style.display = hasUnico ? 'flex' : 'none';

  if (hasUnico && termUnicoAmt) {
    animateCount(termUnicoAmt, prevTotalUnico, grandUnico);
    prevTotalUnico = grandUnico;
    if (termUnicoIva) termUnicoIva.textContent = fmt(Math.round(grandUnico * 1.16));
  }

  // Folio display
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

// ─────────────────────────────────────────
// TYPEWRITER EN TERMINAL
// ─────────────────────────────────────────
function typeTerminalLine(id) {
  const body = document.getElementById('terminalBody');
  body.style.transition = 'background .1s';
  body.style.background = 'rgba(56,216,78,0.04)';
  setTimeout(() => { body.style.background = ''; }, 200);
}

// ─────────────────────────────────────────
// EXPORT: WHATSAPP
// ─────────────────────────────────────────
function exportWhatsApp() {
  if (!assertAny()) return;

  const empresa  = val('empresa')  || '—';
  const contacto = val('contacto') || '—';
  const notas    = val('notas');
  const fecha    = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  const user     = getCurrentUser();

  let totalMensual = 0;
  let totalUnico   = 0;
  let linesMensual = '';
  let linesUnico   = '';

  activeModules.forEach(id => {
    const svc  = SERVICES.find(s => s.id === id);
    const calc = calcSvc(id);

    if (calc.mode === 'mensual') {
      totalMensual += calc.total;
      const p = calc.qty !== 1 ? 's' : '';
      linesMensual += `\n✅ *${svc.name} — ${svc.sub}*\n`;
      if (calc.base > 0) linesMensual += `   • Base mensual: ${fmt(calc.base)}\n`;
      linesMensual += `   • ${calc.qty} ${calc.varUnit}${p} × ${fmt(calc.varRate)}: ${fmt(calc.variable)}\n`;
      linesMensual += `   • *Subtotal: ${fmt(calc.total)}/mes*\n`;
    } else if (calc.mode === 'hora') {
      totalUnico += calc.total;
      linesUnico += `\n⚡ *${svc.name} — Por hora*\n`;
      linesUnico += `   • ${calc.hours} hrs × ${fmt(calc.hourlyRate)}/hr\n`;
      linesUnico += `   • *Subtotal: ${fmt(calc.total)}*\n`;
    } else if (calc.mode === 'proyecto') {
      totalUnico += calc.total;
      linesUnico += `\n🔧 *${svc.name} — Proyecto*\n`;
      linesUnico += `   • *Monto: ${fmt(calc.total)}*\n`;
    }
  });

  // Equipos
  let linesEquip = '';
  equipmentItems.forEach(item => {
    const cat = EQUIP_CATALOG.find(c => c.id === item.catalogId);
    const icon = cat ? cat.icon : '📦';
    const lineTotal = item.qty * item.unitPrice;
    totalUnico += lineTotal;
    linesEquip += `\n${icon} ${item.name || 'Equipo'} ×${item.qty} = ${fmt(lineTotal)}`;
  });

  const folioLine = currentFolio ? `\n📋 Folio: ${currentFolio}` : '';
  const vendedorLine = user ? `\n👨‍💼 Vendedor: ${user.name} (${user.id})` : '';

  let text = `🔧 *PROPUESTA MIRMIBUG IT SOLUTIONS*\n📅 ${fecha}\n🏢 Empresa: ${empresa}\n👤 Contacto: ${contacto}${vendedorLine}${folioLine}\n`;

  if (linesMensual) {
    text += `\n*─── SERVICIOS MENSUALES ───*${linesMensual}`;
  }
  if (linesUnico) {
    text += `\n*─── SERVICIOS ÚNICOS ───*${linesUnico}`;
  }
  if (linesEquip) {
    text += `\n*─── EQUIPOS ───*${linesEquip}\n`;
  }

  text += `\n━━━━━━━━━━━━━━━━━━━`;
  if (totalMensual > 0) {
    text += `\n💰 *MENSUAL: ${fmt(totalMensual)} MXN*`;
    text += `\n💼 *Con IVA (16%): ${fmt(Math.round(totalMensual * 1.16))} MXN*`;
  }
  if (totalUnico > 0) {
    text += `\n💰 *ÚNICO: ${fmt(totalUnico)} MXN*`;
    text += `\n💼 *Con IVA (16%): ${fmt(Math.round(totalUnico * 1.16))} MXN*`;
  }
  text += `\n━━━━━━━━━━━━━━━━━━━`;
  if (notas) text += `\n\n📝 ${notas}`;
  text += `\n\n_Precios en MXN sin IVA. Contrato mensual, sin permanencia mínima. Válida 30 días._`;
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
      const folioHtml = data.folio
        ? `<div class="cv-share-folio">// FOLIO: ${data.folio}</div>`
        : '';
      resultEl.innerHTML = `
        ${folioHtml}
        <div class="cv-share-url">
          <input type="text" id="shareUrl" value="${url}" readonly />
          <button type="button" onclick="copyShareUrl()">COPIAR</button>
        </div>
        <span class="cv-share-hint">// link válido 60 días</span>`;

      // Actualizar folio en terminal
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

  const q       = buildQuoteData();
  const summary = q.items.map(i => `${i.name} (${i.mode}): ${fmt(i.total)}`).join('\n');
  const equipSummary = q.equipment.map(e => `${e.name} ×${e.qty}: ${fmt(e.lineTotal)}`).join('\n');
  const folioNote = currentFolio ? `\nFolio: ${currentFolio}` : '';

  let body = `Propuesta IT Mirmibug:${folioNote}\n\n${summary}`;
  if (equipSummary) body += `\n\nEquipos:\n${equipSummary}`;
  if (q.total_mensual > 0) body += `\n\nTOTAL MENSUAL: ${fmt(q.total_mensual)} MXN (sin IVA) — Con IVA: ${fmt(Math.round(q.total_mensual * 1.16))} MXN`;
  if (q.total_unico > 0) body += `\nTOTAL ÚNICO: ${fmt(q.total_unico)} MXN (sin IVA) — Con IVA: ${fmt(Math.round(q.total_unico * 1.16))} MXN`;

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
  let totalMensual = 0;
  let totalUnico   = 0;
  const items = [];
  const user = getCurrentUser();

  activeModules.forEach(id => {
    const svc  = SERVICES.find(s => s.id === id);
    const calc = calcSvc(id);

    const item = {
      id, name: svc.name, icon: svc.icon, sub: svc.sub,
      mode: calc.mode, total: calc.total, desc: svc.desc
    };

    if (calc.mode === 'mensual') {
      totalMensual += calc.total;
      item.base = calc.base;
      item.qty = calc.qty;
      item.varUnit = calc.varUnit;
      item.varRate = calc.varRate;
      item.variable = calc.variable;
    } else if (calc.mode === 'hora') {
      totalUnico += calc.total;
      item.hours = calc.hours;
      item.hourlyRate = calc.hourlyRate;
    } else if (calc.mode === 'proyecto') {
      totalUnico += calc.total;
    }

    items.push(item);
  });

  // Equipos
  const equipment = equipmentItems.map(item => {
    const lineTotal = item.qty * item.unitPrice;
    totalUnico += lineTotal;
    return {
      catalogId: item.catalogId,
      name: item.name,
      qty: item.qty,
      unitPrice: item.unitPrice,
      lineTotal
    };
  });

  return {
    empresa:        val('empresa'),
    contacto:       val('contacto'),
    email:          val('emailCliente'),
    vendedor:       val('vendedor'),
    vendedor_id:    user?.id || '',
    notas:          val('notas'),
    fecha:          new Date().toISOString().split('T')[0],
    items,
    equipment,
    total_mensual:  totalMensual,
    total_unico:    totalUnico,
    total:          totalMensual + totalUnico   // legacy compat
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
    if (q.empresa)  document.getElementById('empresa').value      = q.empresa;
    if (q.contacto) document.getElementById('contacto').value     = q.contacto;
    if (q.email)    document.getElementById('emailCliente').value = q.email;
    if (q.notas)    document.getElementById('notas').value        = q.notas;

    // Folio
    if (q.folio) {
      currentFolio = q.folio;
      const resultEl = document.getElementById('shareResult');
      resultEl.style.display = 'block';
      resultEl.innerHTML = `<div class="cv-share-folio">// FOLIO: ${q.folio}</div>`;
    }

    // Restaurar servicios con modo
    if (q.items) {
      q.items.forEach(item => {
        if (!activeModules.has(item.id)) activateModule(item.id);

        // Restaurar modo
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

    // Restaurar equipos
    if (q.equipment && Array.isArray(q.equipment)) {
      q.equipment.forEach(eq => {
        const uid = ++equipUidCounter;
        equipmentItems.push({
          uid,
          catalogId: eq.catalogId || 'otro',
          name: eq.name || '',
          qty: eq.qty || 1,
          unitPrice: eq.unitPrice || 0
        });
      });
      renderEquipRows();
    }

    updateSummary();
  } catch {
    console.warn('No se pudo cargar la propuesta.');
  }
}

// ─────────────────────────────────────────
// PRINT / PDF
// ─────────────────────────────────────────
function triggerPrint() {
  if (!assertAny()) return;
  buildPrintView();
  window.print();
}

function buildPrintView() {
  const q = buildQuoteData();
  if (q.items.length === 0 && q.equipment.length === 0) return;

  const fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  const user  = getCurrentUser();

  // ── Servicios mensuales ──
  const mensualItems = q.items.filter(i => i.mode === 'mensual');
  const unicoItems   = q.items.filter(i => i.mode !== 'mensual');

  let mensualRows = '';
  mensualItems.forEach(item => {
    const p = (item.qty || 0) !== 1 ? 's' : '';
    mensualRows += `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-weight:600">${item.icon} ${item.name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#555;font-size:11px">${item.desc}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right">${(item.base || 0) > 0 ? fmt(item.base) : '—'}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center">${item.qty} ${item.varUnit}${p}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right">${fmt(item.varRate)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-weight:700;color:#38d84e;text-align:right">${fmt(item.total)}</td>
      </tr>`;
  });

  // ── Servicios únicos ──
  let unicoRows = '';
  unicoItems.forEach(item => {
    let detailCol = '';
    let qtyCol = '';
    let unitCol = '';

    if (item.mode === 'hora') {
      detailCol = item.desc;
      qtyCol = `${item.hours} hrs`;
      unitCol = fmt(item.hourlyRate) + '/hr';
    } else {
      detailCol = item.desc;
      qtyCol = 'Proyecto';
      unitCol = '—';
    }

    unicoRows += `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-weight:600">${item.icon} ${item.name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#555;font-size:11px">${detailCol}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right">—</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center">${qtyCol}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right">${unitCol}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-weight:700;color:#38d84e;text-align:right">${fmt(item.total)}</td>
      </tr>`;
  });

  // ── Equipos ──
  let equipRows = '';
  q.equipment.forEach(eq => {
    const cat = EQUIP_CATALOG.find(c => c.id === eq.catalogId);
    const icon = cat ? cat.icon : '📦';
    equipRows += `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-weight:600">${icon} ${eq.name || 'Equipo'}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#555;font-size:11px">Hardware</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right">—</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center">${eq.qty}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right">${fmt(eq.unitPrice)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-weight:700;color:#38d84e;text-align:right">${fmt(eq.lineTotal)}</td>
      </tr>`;
  });

  // ── Build sections ──
  const tableHead = `
    <thead>
      <tr style="background:#38d84e;color:#000">
        <th style="padding:10px 12px;text-align:left">Servicio</th>
        <th style="padding:10px 12px;text-align:left">Descripción</th>
        <th style="padding:10px 12px;text-align:right">Base</th>
        <th style="padding:10px 12px;text-align:center">Cantidad</th>
        <th style="padding:10px 12px;text-align:right">P. Unit.</th>
        <th style="padding:10px 12px;text-align:right">Subtotal</th>
      </tr>
    </thead>`;

  let tablesHtml = '';

  if (mensualRows) {
    tablesHtml += `
      <div style="font-size:11px;font-weight:800;color:#38d84e;letter-spacing:2px;margin:16px 0 8px;text-transform:uppercase">Servicios Recurrentes (Mensual)</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">
        ${tableHead}
        <tbody>${mensualRows}</tbody>
      </table>`;
  }

  if (unicoRows) {
    tablesHtml += `
      <div style="font-size:11px;font-weight:800;color:#38d84e;letter-spacing:2px;margin:16px 0 8px;text-transform:uppercase">Servicios Únicos</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">
        ${tableHead}
        <tbody>${unicoRows}</tbody>
      </table>`;
  }

  if (equipRows) {
    tablesHtml += `
      <div style="font-size:11px;font-weight:800;color:#38d84e;letter-spacing:2px;margin:16px 0 8px;text-transform:uppercase">Equipos / Hardware</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">
        ${tableHead}
        <tbody>${equipRows}</tbody>
      </table>`;
  }

  // ── Totals ──
  let totalsHtml = '<div style="display:flex;justify-content:flex-end;gap:16px;margin-bottom:20px;flex-wrap:wrap">';

  if (q.total_mensual > 0) {
    totalsHtml += `
      <div style="text-align:right;background:#f9f9f9;padding:16px 24px;border-radius:8px;border-left:4px solid #38d84e">
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Total Mensual (sin IVA)</div>
        <div style="font-size:24px;font-weight:900;color:#38d84e">${fmt(q.total_mensual)} MXN</div>
        <div style="font-size:12px;color:#777;margin-top:4px">Con IVA (16%): ${fmt(Math.round(q.total_mensual * 1.16))} MXN</div>
      </div>`;
  }

  if (q.total_unico > 0) {
    totalsHtml += `
      <div style="text-align:right;background:#f9f9f9;padding:16px 24px;border-radius:8px;border-left:4px solid #2196F3">
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Total Único (sin IVA)</div>
        <div style="font-size:24px;font-weight:900;color:#2196F3">${fmt(q.total_unico)} MXN</div>
        <div style="font-size:12px;color:#777;margin-top:4px">Con IVA (16%): ${fmt(Math.round(q.total_unico * 1.16))} MXN</div>
      </div>`;
  }

  totalsHtml += '</div>';

  document.getElementById('printView').innerHTML = `
    <div style="max-width:820px;margin:0 auto;font-family:Inter,Arial,sans-serif;color:#111;padding:24px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #38d84e;padding-bottom:18px;margin-bottom:24px">
        <div>
          <div style="font-size:22px;font-weight:900;color:#38d84e;letter-spacing:2px">MIRMIBUG IT SOLUTIONS</div>
          <div style="font-size:12px;color:#666;margin-top:4px">contacto@mirmibug.com · mirmibug.com</div>
        </div>
        <div style="text-align:right;font-size:12px;color:#555">
          <div><b>Fecha:</b> ${fecha}</div>
          ${user ? `<div><b>Vendedor:</b> ${user.name} (${user.id})</div>` : ''}
          ${currentFolio ? `<div><b>Folio:</b> ${currentFolio}</div>` : ''}
        </div>
      </div>

      <div style="background:#f9f9f9;padding:14px 18px;border-radius:8px;margin-bottom:22px">
        <div style="font-size:16px;font-weight:800;margin-bottom:8px">Propuesta de Servicios IT Administrados</div>
        ${q.empresa  ? `<div style="font-size:13px;margin-bottom:2px"><b>Empresa:</b> ${q.empresa}</div>` : ''}
        ${q.contacto ? `<div style="font-size:13px;margin-bottom:2px"><b>Contacto:</b> ${q.contacto}</div>` : ''}
        ${q.email    ? `<div style="font-size:13px"><b>Email:</b> ${q.email}</div>` : ''}
      </div>

      ${tablesHtml}

      ${totalsHtml}

      ${q.notas ? `<div style="padding:12px 16px;border:1px solid #ddd;border-radius:6px;font-size:12px;color:#444;margin-bottom:20px"><b>Notas:</b> ${q.notas}</div>` : ''}

      <div style="font-size:10px;color:#999;border-top:1px solid #eee;padding-top:14px;line-height:1.7">
        Precios en MXN sin IVA. IVA aplicable 16%. Contrato mensual sin permanencia mínima. Propuesta válida 30 días.
        Consultas: <b>contacto@mirmibug.com</b>
      </div>
    </div>`;
}

// ─────────────────────────────────────────
// ADMIN PANEL — GESTIÓN DE VENDEDORES
// ─────────────────────────────────────────

function openAdminPanel() {
  document.getElementById('adminPanel').style.display = 'flex';
  loadVendors();
}

function closeAdminPanel() {
  document.getElementById('adminPanel').style.display = 'none';
}

async function adminFetch(action, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': getAdminToken()
    }
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}?action=${action}`, opts);
  return res.json();
}

async function loadVendors() {
  const list = document.getElementById('vendorList');
  list.innerHTML = '<div class="admin-loading">Cargando...</div>';

  try {
    const data = await adminFetch('list');
    if (!data.ok) {
      list.innerHTML = `<div class="admin-error">Error: ${data.error}</div>`;
      return;
    }

    if (data.vendors.length === 0) {
      list.innerHTML = '<div class="admin-empty">No hay vendedores</div>';
      return;
    }

    const currentUser = getCurrentUser();
    list.innerHTML = data.vendors.map(v => {
      const isSelf = v.vendor_id === currentUser?.id;
      const statusClass = v.active == 1 ? 'admin-status-active' : 'admin-status-inactive';
      const statusText  = v.active == 1 ? 'ACTIVO' : 'INACTIVO';
      const roleTag     = v.role === 'admin' ? '<span class="admin-role-tag">ADMIN</span>' : '';

      return `
        <div class="admin-row ${v.active == 1 ? '' : 'admin-row-inactive'}">
          <div class="admin-row-info">
            <span class="admin-row-id">${v.vendor_id}</span>
            <span class="admin-row-name">${v.name}</span>
            ${roleTag}
            <span class="${statusClass}">${statusText}</span>
          </div>
          <div class="admin-row-actions">
            <button onclick="promptChangePin('${v.vendor_id}', '${v.name}')" class="admin-action-btn" title="Cambiar PIN">🔑</button>
            ${!isSelf ? `<button onclick="toggleVendor('${v.vendor_id}')" class="admin-action-btn" title="${v.active == 1 ? 'Desactivar' : 'Activar'}">${v.active == 1 ? '⏸' : '▶'}</button>` : ''}
            ${!isSelf ? `<button onclick="deleteVendor('${v.vendor_id}', '${v.name}')" class="admin-action-btn admin-action-danger" title="Eliminar">🗑</button>` : ''}
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    list.innerHTML = '<div class="admin-error">Error de conexión</div>';
  }
}

async function createVendor() {
  const nameInput = document.getElementById('newVendorName');
  const pinInput  = document.getElementById('newVendorPin');
  const name = nameInput.value.trim();
  const pin  = pinInput.value.trim();

  if (!name || !pin) {
    alert('Nombre y PIN son requeridos');
    return;
  }
  if (pin.length < 4) {
    alert('El PIN debe tener al menos 4 caracteres');
    return;
  }

  try {
    const data = await adminFetch('create', 'POST', { name, pin });
    if (data.ok) {
      nameInput.value = '';
      pinInput.value  = '';
      loadVendors();
    } else {
      alert('Error: ' + (data.error || 'No se pudo crear'));
    }
  } catch {
    alert('Error de conexión');
  }
}

function promptChangePin(vendorId, vendorName) {
  const newPin = prompt(`Nuevo PIN para ${vendorName} (${vendorId}):\n(mínimo 4 caracteres)`);
  if (!newPin) return;
  if (newPin.trim().length < 4) {
    alert('El PIN debe tener al menos 4 caracteres');
    return;
  }
  changePin(vendorId, newPin.trim());
}

async function changePin(vendorId, newPin) {
  try {
    const data = await adminFetch('update_pin', 'POST', { vendor_id: vendorId, new_pin: newPin });
    if (data.ok) {
      alert('PIN actualizado correctamente');
    } else {
      alert('Error: ' + (data.error || 'No se pudo actualizar'));
    }
  } catch {
    alert('Error de conexión');
  }
}

async function toggleVendor(vendorId) {
  try {
    const data = await adminFetch('toggle', 'POST', { vendor_id: vendorId });
    if (data.ok) {
      loadVendors();
    } else {
      alert('Error: ' + (data.error || 'No se pudo cambiar estado'));
    }
  } catch {
    alert('Error de conexión');
  }
}

async function deleteVendor(vendorId, vendorName) {
  if (!confirm(`¿Eliminar a ${vendorName} (${vendorId})?\nEsta acción no se puede deshacer.`)) return;

  try {
    const data = await adminFetch('delete', 'POST', { vendor_id: vendorId });
    if (data.ok) {
      loadVendors();
    } else {
      alert('Error: ' + (data.error || 'No se pudo eliminar'));
    }
  } catch {
    alert('Error de conexión');
  }
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
