<?php
declare(strict_types=1);

$token = trim((string)($_GET['token'] ?? ''));

// Validar token: exactamente 16 hex
if (strlen($token) !== 16 || !ctype_xdigit($token)) {
    http_response_code(404);
    include __DIR__ . '/404.html' ?: die('Propuesta no encontrada.');
    exit;
}

require_once __DIR__ . '/api/config.php';

try {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

    $stmt = $pdo->prepare("
        SELECT quote_json, folio, vendedor_id, expires_at
        FROM sales_quotes
        WHERE token = ? AND (expires_at IS NULL OR expires_at > NOW())
    ");
    $stmt->execute([$token]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        http_response_code(404);
        die(renderError('Propuesta no encontrada o expirada'));
    }

    $q = json_decode($row['quote_json'], true);
    if (!$q) { http_response_code(500); die(renderError('Error al leer la propuesta')); }

    $q['folio']       = $row['folio'] ?? null;
    $q['vendedor_id'] = $row['vendedor_id'] ?? null;

} catch (Throwable $e) {
    http_response_code(500);
    die(renderError('Error de servidor'));
}

function renderError(string $msg): string {
    return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Error</title>
    <style>body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5}
    .box{text-align:center;padding:40px;background:#fff;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.1)}
    h2{color:#333;margin-bottom:8px}p{color:#666}</style></head>
    <body><div class="box"><h2>⚠ ' . htmlspecialchars($msg) . '</h2>
    <p>Por favor contacta a Mirmibug IT Solutions.</p></div></body></html>';
}

function fmt(float $n): string {
    return '$' . number_format((int)$n, 0, '.', ',');
}

$empresa   = htmlspecialchars($q['empresa']          ?? '');
$contacto  = htmlspecialchars($q['contacto']          ?? '');
$email     = htmlspecialchars($q['email']             ?? '');
$rfc_cli   = htmlspecialchars($q['rfc_cliente']       ?? '');
$vendedor  = htmlspecialchars($q['vendedor']          ?? '');
$notas     = htmlspecialchars($q['notas']             ?? '');
$condPago  = htmlspecialchars($q['condiciones_pago']  ?? '');
$folio     = htmlspecialchars($q['folio']             ?? '');
$descPct   = (float)($q['descuento_pct']  ?? 0);
$totalMen  = (float)($q['total_mensual']  ?? 0);
$totalUni  = (float)($q['total_unico']    ?? 0);
$rawMen    = (float)($q['raw_mensual']    ?? $totalMen);
$rawUni    = (float)($q['raw_unico']      ?? $totalUni);

$vigDias = (int)($q['vigencia_dias'] ?? 30);
$fecha   = date('d \d\e F \d\e Y');
$vigDate = date('d \d\e F \d\e Y', strtotime("+{$vigDias} days"));

$items     = $q['items']     ?? [];
$equipment = $q['equipment'] ?? [];

// ── Filas de servicios ──
function tableHead(): string {
    return '<thead><tr style="background:#38d84e;color:#000">
        <th style="padding:9px 10px;text-align:left;font-size:11px">Servicio</th>
        <th style="padding:9px 10px;text-align:right;font-size:11px">Base</th>
        <th style="padding:9px 10px;text-align:center;font-size:11px">Cantidad</th>
        <th style="padding:9px 10px;text-align:right;font-size:11px">P. Unit.</th>
        <th style="padding:9px 10px;text-align:right;font-size:11px">Subtotal</th>
    </tr></thead>';
}

function tdCell(string $content, string $align = 'left', bool $bold = false): string {
    $style = "padding:9px 10px;border-bottom:1px solid #eee;text-align:$align;font-size:11px;" .
             ($bold ? 'font-weight:700;color:#38d84e' : 'color:#333');
    return "<td style=\"$style\">$content</td>";
}

$mensualRows = '';
$unicoRows   = '';
$equipRows   = '';

foreach ($items as $item) {
    $icon = htmlspecialchars($item['icon'] ?? '');
    $name = htmlspecialchars($item['name'] ?? '');
    $mode = $item['mode'] ?? 'mensual';

    if ($mode === 'mensual') {
        $qty     = (int)($item['qty']     ?? 1);
        $unit    = htmlspecialchars($item['varUnit'] ?? 'unidad');
        $plural  = $qty !== 1 ? 's' : '';
        $base    = (float)($item['base']    ?? 0);
        $varRate = (float)($item['varRate'] ?? 0);
        $total   = (float)($item['total']   ?? 0);
        $mensualRows .= '<tr>' .
            tdCell("<b>$icon $name</b>") .
            tdCell($base > 0 ? fmt($base) : '—', 'right') .
            tdCell("$qty $unit$plural", 'center') .
            tdCell(fmt($varRate), 'right') .
            tdCell(fmt($total), 'right', true) .
            '</tr>';
    } else {
        $total   = (float)($item['total'] ?? 0);
        $qtyCol  = $mode === 'hora' ? ($item['hours'] ?? 0) . ' hrs' : 'Proyecto';
        $unitCol = $mode === 'hora' ? fmt((float)($item['hourlyRate'] ?? 0)) . '/hr' : '—';
        $unicoRows .= '<tr>' .
            tdCell("<b>$icon $name</b>") .
            tdCell('—', 'right') .
            tdCell($qtyCol, 'center') .
            tdCell($unitCol, 'right') .
            tdCell(fmt($total), 'right', true) .
            '</tr>';
    }
}

foreach ($equipment as $eq) {
    $eqName  = htmlspecialchars($eq['name'] ?? 'Equipo');
    $qty     = (int)($eq['qty']      ?? 1);
    $price   = (float)($eq['unitPrice'] ?? 0);
    $lineT   = (float)($eq['lineTotal'] ?? $qty * $price);
    $equipRows .= '<tr>' .
        tdCell("<b>📦 $eqName</b>") .
        tdCell('—', 'right') .
        tdCell((string)$qty, 'center') .
        tdCell(fmt($price), 'right') .
        tdCell(fmt($lineT), 'right', true) .
        '</tr>';
}

function buildSection(string $label, string $rows): string {
    if (!$rows) return '';
    return '<div style="font-size:10px;font-weight:800;color:#38d84e;letter-spacing:2px;margin:18px 0 6px;text-transform:uppercase;border-left:3px solid #38d84e;padding-left:8px">' . $label . '</div>' .
           '<table style="width:100%;border-collapse:collapse;margin-bottom:4px">' . tableHead() . '<tbody>' . $rows . '</tbody></table>';
}

$tablesHtml  = buildSection('Servicios Recurrentes — Mensual', $mensualRows);
$tablesHtml .= buildSection('Servicios por Hora / Proyecto', $unicoRows);
$tablesHtml .= buildSection('Equipos / Hardware', $equipRows);

// ── Totales ──
function totalBox(string $label, float $raw, float $disc, float $total, float $descPct, string $color): string {
    $discRow = $disc > 0
        ? '<div style="font-size:11px;color:#e53935;margin:4px 0">Descuento (' . $descPct . '%): -' . fmt($disc) . '</div>'
        : '';
    $sub = $disc > 0 ? '<div style="font-size:12px;color:#aaa;margin-bottom:2px">Subtotal: ' . fmt($raw) . '</div>' : '';
    return '<div style="text-align:right;background:#fafafa;padding:14px 20px;border-radius:6px;border-left:4px solid ' . $color . ';min-width:220px">' .
           '<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">' . $label . '</div>' .
           $sub . $discRow .
           '<div style="font-size:22px;font-weight:900;color:' . $color . '">' . fmt($total) . ' MXN</div>' .
           '<div style="font-size:11px;color:#777;margin-top:4px">+ IVA 16%: <b>' . fmt((int)round($total * 0.16)) . ' MXN</b></div>' .
           '<div style="font-size:12px;color:#444;margin-top:2px;font-weight:700">Total c/IVA: ' . fmt((int)round($total * 1.16)) . ' MXN</div>' .
           '</div>';
}

$totalsHtml = '<div style="display:flex;justify-content:flex-end;gap:12px;margin:20px 0;flex-wrap:wrap">';
if ($totalMen > 0) $totalsHtml .= totalBox('Total Mensual (sin IVA)', $rawMen, $rawMen * $descPct / 100, $totalMen, $descPct, '#38d84e');
if ($totalUni > 0) $totalsHtml .= totalBox('Total Único (sin IVA)',   $rawUni, $rawUni * $descPct / 100, $totalUni, $descPct, '#2196F3');
$totalsHtml .= '</div>';

$logoUrl = 'https://mirmibug.com/img/mirmibug-logo-green_sfondo.png';
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title><?= $folio ? $folio . ' — ' : '' ?>Propuesta Mirmibug<?= $empresa ? ' · ' . $empresa : '' ?></title>
  <meta name="robots" content="noindex, nofollow" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Inter, Arial, sans-serif; background: #f0f2f5; color: #111; font-size: 13px; min-height: 100vh; }
    .page { max-width: 900px; margin: 32px auto; background: #fff; border-radius: 8px; padding: 32px 36px; box-shadow: 0 2px 20px rgba(0,0,0,.08); }
    .badge { display: inline-block; background: #f0fdf4; color: #38d84e; border: 1px solid #c6f6d5; border-radius: 4px; padding: 3px 10px; font-size: 11px; font-weight: 700; letter-spacing: 1px; }
    @media print {
      body { background: #fff; }
      .page { box-shadow: none; margin: 0; border-radius: 0; }
      .no-print { display: none !important; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    @media (max-width: 600px) {
      .page { margin: 0; border-radius: 0; padding: 20px; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- HEADER EMPRESA -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;margin-bottom:20px;border-bottom:3px solid #38d84e">
    <div style="display:flex;align-items:center;gap:14px">
      <img src="<?= $logoUrl ?>" alt="Mirmibug" style="width:52px;height:52px;object-fit:contain" onerror="this.style.display='none'" />
      <div>
        <div style="font-size:20px;font-weight:900;color:#38d84e;letter-spacing:1px">MIRMIBUG IT SOLUTIONS</div>
        <div style="font-size:10px;color:#666;margin-top:2px">contacto@mirmibug.com · mirmibug.com</div>
      </div>
    </div>
    <div style="text-align:right;font-size:11px;color:#444;line-height:1.9">
      <div style="font-size:13px;font-weight:800;color:#111;letter-spacing:.5px">PROPUESTA COMERCIAL</div>
      <?php if ($folio): ?><div><b>Folio:</b> <?= $folio ?></div><?php endif; ?>
      <div><b>Fecha:</b> <?= $fecha ?></div>
      <div><b>Válida hasta:</b> <?= $vigDate ?></div>
      <?php if ($vendedor): ?><div><b>Vendedor:</b> <?= $vendedor ?></div><?php endif; ?>
    </div>
  </div>

  <!-- DATOS CLIENTE -->
  <div style="background:#f9f9f9;padding:12px 16px;border-radius:6px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
    <div>
      <div style="font-size:10px;font-weight:800;color:#38d84e;letter-spacing:2px;margin-bottom:6px;text-transform:uppercase">Para</div>
      <?php if ($empresa):  ?><div style="font-size:14px;font-weight:700"><?= $empresa ?></div><?php endif; ?>
      <?php if ($rfc_cli):  ?><div style="font-size:11px;color:#555">RFC: <?= $rfc_cli ?></div><?php endif; ?>
      <?php if ($contacto): ?><div style="font-size:11px;color:#555;margin-top:2px">Attn: <?= $contacto ?></div><?php endif; ?>
      <?php if ($email):    ?><div style="font-size:11px;color:#555"><?= $email ?></div><?php endif; ?>
    </div>
    <div style="text-align:right">
      <span class="badge">Servicios IT Administrados</span>
    </div>
  </div>

  <!-- TABLAS -->
  <?= $tablesHtml ?>

  <!-- TOTALES -->
  <?= $totalsHtml ?>

  <!-- CONDICIONES DE PAGO -->
  <?php if ($condPago): ?>
  <div style="background:#f0fdf4;border:1px solid #c6f6d5;border-radius:6px;padding:12px 16px;margin-bottom:16px">
    <div style="font-size:10px;font-weight:800;color:#38d84e;letter-spacing:2px;margin-bottom:6px;text-transform:uppercase">Condiciones de Pago</div>
    <div style="font-size:12px"><b>Forma:</b> <?= $condPago ?></div>
  </div>
  <?php endif; ?>

  <!-- NOTAS -->
  <?php if ($notas): ?>
  <div style="padding:10px 14px;border:1px solid #ddd;border-radius:6px;font-size:11px;color:#444;margin-bottom:16px">
    <b>Notas y condiciones especiales:</b><br><?= nl2br($notas) ?>
  </div>
  <?php endif; ?>

  <!-- FIRMAS -->
  <div style="display:flex;justify-content:space-between;gap:32px;margin:28px 0 20px;padding-top:20px;border-top:1px solid #eee">
    <div style="flex:1;text-align:center">
      <div style="border-top:1px solid #999;margin-bottom:8px;padding-top:10px;margin-top:40px"></div>
      <div style="font-size:11px;font-weight:700">Autorizado por</div>
      <div style="font-size:10px;color:#666">Mirmibug IT Solutions</div>
      <?php if ($vendedor): ?><div style="font-size:10px;color:#888"><?= $vendedor ?></div><?php endif; ?>
    </div>
    <div style="flex:1;text-align:center">
      <div style="border-top:1px solid #999;margin-bottom:8px;padding-top:10px;margin-top:40px"></div>
      <div style="font-size:11px;font-weight:700">Acepto y apruebo</div>
      <div style="font-size:10px;color:#666"><?= $empresa ?: 'Cliente' ?></div>
      <?php if ($contacto): ?><div style="font-size:10px;color:#888"><?= $contacto ?></div><?php endif; ?>
    </div>
  </div>

  <!-- FOOTER -->
  <div style="font-size:9px;color:#aaa;border-top:1px solid #eee;padding-top:10px;line-height:1.8;margin-bottom:16px">
    Precios en MXN sin IVA. IVA aplicable 16%. Propuesta válida hasta el <?= $vigDate ?>.
    Consultas: <b>contacto@mirmibug.com</b> · <b>mirmibug.com</b>
  </div>

  <!-- BOTÓN IMPRIMIR (solo en pantalla) -->
  <div class="no-print" style="text-align:center;margin-top:16px">
    <button onclick="window.print()" style="padding:10px 28px;background:#38d84e;border:none;border-radius:4px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit">
      🖨 Imprimir / Guardar como PDF
    </button>
  </div>

</div>
</body>
</html>
