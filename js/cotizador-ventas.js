/* =========================
   COTIZADOR DE VENTAS — TECH REDESIGN
   Mirmibug IT Solutions · México
   Cada vendedor tiene su propio PIN.
   Para agregar vendedores: añadir una línea al array USERS.
========================= */

'use strict';

// ─────────────────────────────────────────
// USUARIOS (agregar vendedores aquí)
// ─────────────────────────────────────────
const USERS = [
  { id: 'V001', name: 'Andres', pin: 'mirmi2026' },
  // { id: 'V002', name: 'Carlos', pin: 'ventas2026' },
  // { id: 'V003', name: 'Laura',  pin: 'laura2026' },
];

// ─────────────────────────────────────────
// CATÁLOGO DE SERVICIOS
// ─────────────────────────────────────────
const SERVICES = [
  {
    id: 'helpdesk', name: 'HELP DESK', sub: '8×5 remoto',
    icon: '🖥️', base: 3500, varRate: 380,
    varLabel: 'Usuarios', varUnit: 'usuario', defaultQty: 5, min: 1,
    desc: 'Soporte remoto, tickets ilimitados razonables, altas/bajas, soporte M365/Google, documentación básica, SLA estándar.'
  },
  {
    id: 'monitoreo', name: 'MONITOREO', sub: 'RMM proactivo',
    icon: '📡', base: 2000, varRate: 120,
    varLabel: 'Equipos', varUnit: 'equipo', defaultQty: 10, min: 1,
    desc: 'Monitoreo de salud (CPU, RAM, disco), alertas, inventario, parches básicos, prevención de fallas.'
  },
  {
    id: 'seguridad', name: 'SEGURIDAD', sub: 'Endpoint EDR',
    icon: '🛡️', base: 2500, varRate: 180,
    varLabel: 'Usuarios', varUnit: 'usuario', defaultQty: 5, min: 1,
    desc: 'Protección antivirus/EDR, políticas de seguridad base, hardening inicial, respuesta básica ante incidentes.'
  },
  {
    id: 'redes', name: 'REDES', sub: 'Admin. básica',
    icon: '🌐', base: 2800, varRate: 90,
    varLabel: 'Dispositivos', varUnit: 'dispositivo', defaultQty: 5, min: 1,
    desc: 'Gestión de firewall, switches y APs, cambios menores, respaldo de configuración, monitoreo de red.'
  },
  {
    id: 'infra', name: 'INFRA', sub: 'Servidores / Cloud',
    icon: '🖧', base: 4500, varRate: 750,
    varLabel: 'Servidores', varUnit: 'servidor', defaultQty: 1, min: 1,
    desc: 'Gestión de servidores, monitoreo, revisión de backups, mantenimiento preventivo, soporte cloud básico.'
  },
  {
    id: 'desarrollo', name: 'DESARROLLO', sub: 'Automatización',
    icon: '⚙️', base: 0, varRate: 750,
    varLabel: 'Horas / mes', varUnit: 'hora', defaultQty: 10, min: 1,
    desc: 'Scripts, automatizaciones, mejoras internas, integraciones técnicas a medida.'
  },
  {
    id: 'bi', name: 'BI & DATA', sub: 'Dashboards / SQL',
    icon: '📊', base: 3000, varRate: 650,
    varLabel: 'Horas / mes', varUnit: 'hora', defaultQty: 5, min: 1,
    desc: 'Desarrollo de dashboards, consultas SQL, reportes ejecutivos, automatización de datos.'
  },
  {
    id: 'ia', name: 'INTEGRACIONES IA', sub: 'APIs + Bots',
    icon: '🤖', base: 4000, varRate: 850,
    varLabel: 'Horas / mes', varUnit: 'hora', defaultQty: 5, min: 1,
    desc: 'Integración con APIs de IA, bots internos, automatizaciones inteligentes, pruebas y despliegue inicial.'
  },
  {
    id: 'sitio', name: 'SITIO CDMX', sub: 'Visita presencial',
    icon: '📍', base: 1200, varRate: 1800,
    varLabel: 'Visitas / mes', varUnit: 'visita', defaultQty: 1, min: 0,
    desc: 'Atención presencial, troubleshooting físico, instalaciones, revisión de red o equipos en sitio.'
  }
];

const activeModules = new Set();
let prevTotal = 0;
let currentFolio = null;

// ─────────────────────────────────────────
// USUARIOS: helpers
// ─────────────────────────────────────────
function getCurrentUser() {
  try { return JSON.parse(sessionStorage.getItem('cv_user')); }
  catch { return null; }
}

function logout() {
  sessionStorage.removeItem('cv_auth');
  sessionStorage.removeItem('cv_user');
  location.reload();
}

// ─────────────────────────────────────────
// PIN GATE
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

function checkPin() {
  const v = document.getElementById('pinInput').value.trim().toLowerCase();
  const user = USERS.find(u => u.pin.toLowerCase() === v);

  if (user) {
    sessionStorage.setItem('cv_auth', '1');
    sessionStorage.setItem('cv_user', JSON.stringify({ id: user.id, name: user.name }));
    showApp();
  } else {
    const err = document.getElementById('pinError');
    err.style.display = 'block';
    document.getElementById('pinInput').value = '';
    document.getElementById('pinInput').focus();
    setTimeout(() => { err.style.display = 'none'; }, 2500);
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
  }

  renderCards();
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

        <div class="svc-controls" id="ctrl_${svc.id}">
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

        <div class="svc-rate">${rateTag}</div>

        <button class="svc-close" onclick="event.stopPropagation();deactivateModule('${svc.id}')">✕ quitar</button>
      </div>`;
  }).join('');
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
  const card = document.getElementById('card_' + id);
  card.classList.add('active');
  document.getElementById('stxt_' + id).textContent = 'ON';
  document.getElementById('activeCount').textContent = activeModules.size;
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
  updateSummary();
}

function adjustQty(id, delta) {
  const svc   = SERVICES.find(s => s.id === id);
  const input = document.getElementById('qty_' + id);
  input.value = Math.max(svc.min, (parseInt(input.value) || svc.defaultQty) + delta);
  updateSummary();
}

// ─────────────────────────────────────────
// CALCULAR
// ─────────────────────────────────────────
function calcSvc(id) {
  const svc = SERVICES.find(s => s.id === id);
  const qty = Math.max(svc.min, parseInt(document.getElementById('qty_' + id)?.value) || svc.defaultQty);
  const variable = qty * svc.varRate;
  return { base: svc.base, qty, variable, total: svc.base + variable };
}

function fmt(n)  { return '$' + Math.round(n).toLocaleString('es-MX'); }
function fmt2(n) { return Math.round(n).toLocaleString('es-MX'); }
function val(id) { return document.getElementById(id)?.value?.trim() || ''; }

// ─────────────────────────────────────────
// UPDATE SUMMARY (TERMINAL)
// ─────────────────────────────────────────
function updateSummary() {
  const termItems  = document.getElementById('termItems');
  const termSep    = document.getElementById('termSep');
  const termTotRow = document.getElementById('termTotalRow');
  const termIvaRow = document.getElementById('termIvaRow');
  const termTotal  = document.getElementById('termTotal');
  const termIva    = document.getElementById('termIva');
  const termFolio  = document.getElementById('termFolio');

  if (activeModules.size === 0) {
    termItems.innerHTML  = '<div class="t-line t-info">// Sin servicios activos</div>';
    termSep.style.display    = 'none';
    termTotRow.style.display = 'none';
    termIvaRow.style.display = 'none';
    if (termFolio) termFolio.style.display = 'none';
    prevTotal = 0;
    return;
  }

  let grand = 0;
  let html  = '';

  activeModules.forEach(id => {
    const svc  = SERVICES.find(s => s.id === id);
    const calc = calcSvc(id);
    grand += calc.total;

    document.getElementById('csub_' + id).textContent = fmt(calc.total);

    html += `
      <div class="t-item">
        <span class="t-item-name">+ ${svc.icon} ${svc.name.toLowerCase()} ×${calc.qty}</span>
        <span class="t-item-amount">${fmt(calc.total)}</span>
      </div>`;
  });

  termItems.innerHTML = html;
  termSep.style.display    = 'block';
  termTotRow.style.display = 'flex';
  termIvaRow.style.display = 'flex';

  animateCount(termTotal, prevTotal, grand);
  prevTotal = grand;

  termIva.textContent = fmt(Math.round(grand * 1.16));

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
  if (!assertModules()) return;

  const empresa  = val('empresa')  || '—';
  const contacto = val('contacto') || '—';
  const notas    = val('notas');
  const fecha    = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  const user     = getCurrentUser();

  let total = 0;
  let lines = '';

  activeModules.forEach(id => {
    const svc  = SERVICES.find(s => s.id === id);
    const calc = calcSvc(id);
    const p    = calc.qty !== 1 ? 's' : '';
    total += calc.total;
    lines += `\n✅ *${svc.name} — ${svc.sub}*\n`;
    if (calc.base > 0) lines += `   • Base mensual: ${fmt(calc.base)}\n`;
    lines += `   • ${calc.qty} ${svc.varUnit}${p} × ${fmt(svc.varRate)}: ${fmt(calc.variable)}\n`;
    lines += `   • *Subtotal: ${fmt(calc.total)}*\n`;
  });

  const folioLine = currentFolio ? `\n📋 Folio: ${currentFolio}` : '';
  const vendedorLine = user ? `\n👨‍💼 Vendedor: ${user.name} (${user.id})` : '';

  const text =
`🔧 *PROPUESTA MIRMIBUG IT SOLUTIONS*
📅 ${fecha}
🏢 Empresa: ${empresa}
👤 Contacto: ${contacto}${vendedorLine}${folioLine}

*Servicios incluidos:*${lines}
━━━━━━━━━━━━━━━━━━━
💰 *TOTAL MENSUAL: ${fmt(total)} MXN*
💼 *Con IVA (16%): ${fmt(Math.round(total * 1.16))} MXN*
━━━━━━━━━━━━━━━━━━━
${notas ? `\n📝 ${notas}\n` : ''}
_Precios en MXN sin IVA. Contrato mensual, sin permanencia mínima. Válida 30 días._

📞 Mirmibug IT Solutions
✉️ contacto@mirmibug.com
🌐 mirmibug.com`;

  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}

// ─────────────────────────────────────────
// EXPORT: GUARDAR Y COMPARTIR
// ─────────────────────────────────────────
async function saveAndShare() {
  if (!assertModules()) return;

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
  if (!assertModules()) return;

  const emailCliente = val('emailCliente');
  if (!emailCliente) {
    alert('Ingresa el email del cliente primero.');
    document.getElementById('emailCliente').focus();
    return;
  }

  const q       = buildQuoteData();
  const summary = q.items.map(i => `${i.name}: ${fmt(i.total)}`).join('\n');
  const folioNote = currentFolio ? `\nFolio: ${currentFolio}` : '';

  const fd = new FormData();
  fd.append('nombre',         q.contacto || 'Prospecto');
  fd.append('email',          emailCliente);
  fd.append('empresa',        q.empresa || '');
  fd.append('mensaje',        `Propuesta IT Mirmibug:${folioNote}\n\n${summary}\n\nTOTAL: ${fmt(q.total)} MXN (sin IVA)\nCon IVA: ${fmt(Math.round(q.total * 1.16))} MXN`);
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
  let total = 0;
  const items = [];
  const user = getCurrentUser();

  activeModules.forEach(id => {
    const svc  = SERVICES.find(s => s.id === id);
    const calc = calcSvc(id);
    total += calc.total;
    items.push({
      id, name: svc.name, icon: svc.icon, sub: svc.sub,
      base: calc.base, qty: calc.qty,
      varUnit: svc.varUnit, varRate: svc.varRate,
      variable: calc.variable, total: calc.total, desc: svc.desc
    });
  });

  return {
    empresa:     val('empresa'),
    contacto:    val('contacto'),
    email:       val('emailCliente'),
    vendedor:    val('vendedor'),
    vendedor_id: user?.id || '',
    notas:       val('notas'),
    fecha:       new Date().toISOString().split('T')[0],
    items,
    total
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

    q.items.forEach(item => {
      if (!activeModules.has(item.id)) activateModule(item.id);
      const inp = document.getElementById('qty_' + item.id);
      if (inp) inp.value = item.qty;
    });
    updateSummary();
  } catch {
    console.warn('No se pudo cargar la propuesta.');
  }
}

// ─────────────────────────────────────────
// PRINT / PDF
// ─────────────────────────────────────────
function triggerPrint() {
  if (!assertModules()) return;
  buildPrintView();
  window.print();
}

function buildPrintView() {
  if (activeModules.size === 0) return;

  const q     = buildQuoteData();
  const fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  const user  = getCurrentUser();

  let rows = '';
  q.items.forEach(item => {
    const p = item.qty !== 1 ? 's' : '';
    rows += `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-weight:600">${item.icon} ${item.name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#555;font-size:11px">${item.desc}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right">${item.base > 0 ? fmt(item.base) : '—'}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center">${item.qty} ${item.varUnit}${p}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right">${fmt(item.varRate)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-weight:700;color:#38d84e;text-align:right">${fmt(item.total)}</td>
      </tr>`;
  });

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

      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px">
        <thead>
          <tr style="background:#38d84e;color:#000">
            <th style="padding:10px 12px;text-align:left">Servicio</th>
            <th style="padding:10px 12px;text-align:left">Descripcion</th>
            <th style="padding:10px 12px;text-align:right">Base</th>
            <th style="padding:10px 12px;text-align:center">Cantidad</th>
            <th style="padding:10px 12px;text-align:right">P. Unit.</th>
            <th style="padding:10px 12px;text-align:right">Subtotal</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div style="display:flex;justify-content:flex-end;margin-bottom:20px">
        <div style="text-align:right;background:#f9f9f9;padding:16px 24px;border-radius:8px;border-left:4px solid #38d84e">
          <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Total Mensual (sin IVA)</div>
          <div style="font-size:28px;font-weight:900;color:#38d84e">${fmt(q.total)} MXN</div>
          <div style="font-size:12px;color:#777;margin-top:4px">Con IVA (16%): ${fmt(Math.round(q.total * 1.16))} MXN</div>
        </div>
      </div>

      ${q.notas ? `<div style="padding:12px 16px;border:1px solid #ddd;border-radius:6px;font-size:12px;color:#444;margin-bottom:20px"><b>Notas:</b> ${q.notas}</div>` : ''}

      <div style="font-size:10px;color:#999;border-top:1px solid #eee;padding-top:14px;line-height:1.7">
        Precios en MXN sin IVA. IVA aplicable 16%. Contrato mensual sin permanencia minima. Propuesta valida 30 dias.
        Consultas: <b>contacto@mirmibug.com</b>
      </div>
    </div>`;
}

// ─────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────
function assertModules() {
  if (activeModules.size === 0) {
    alert('Activa al menos un módulo de servicio primero.');
    return false;
  }
  return true;
}

// ─────────────────────────────────────────
// ARRANCAR
// ─────────────────────────────────────────
window.addEventListener('DOMContentLoaded', initPin);
