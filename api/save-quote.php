<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

// ── CORS ──
$allowed_origins = ['https://mirmibug.com'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (preg_match('#^https?://localhost(:\d+)?$#', $origin)) {
  $allowed_origins[] = $origin;
}
if (in_array($origin, $allowed_origins, true)) {
  header("Access-Control-Allow-Origin: $origin");
  header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

define('DB_HOST', 'localhost');
define('DB_NAME', 'andres63_mirmibug_web');
define('DB_USER', 'andres63_adminmirmibug');
define('DB_PASS', 'ygKtYLN.I1g)');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
  exit;
}

$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!$data || empty($data['items']) || !is_array($data['items'])) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Invalid data']);
  exit;
}

try {
  $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
  $pdo = new PDO($dsn, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

  // Token único de 16 caracteres hexadecimales
  do {
    $token = bin2hex(random_bytes(8));
    $chk   = $pdo->prepare('SELECT id FROM sales_quotes WHERE token = ?');
    $chk->execute([$token]);
  } while ($chk->fetch());

  // ── Vendor ID y generación de folio ──
  $vendedor_id = mb_substr((string)($data['vendedor_id'] ?? ''), 0, 10);
  $folio = null;

  if ($vendedor_id !== '' && preg_match('/^V\d{3}$/', $vendedor_id)) {
    $pdo->beginTransaction();

    // Buscar el último folio de este vendedor con lock
    $seqStmt = $pdo->prepare("
      SELECT folio FROM sales_quotes
      WHERE vendedor_id = ?
      ORDER BY id DESC
      LIMIT 1
      FOR UPDATE
    ");
    $seqStmt->execute([$vendedor_id]);
    $lastFolio = $seqStmt->fetchColumn();

    if ($lastFolio && preg_match('/(\d+)$/', $lastFolio, $m)) {
      $nextSeq = intval($m[1]) + 1;
    } else {
      $nextSeq = 1;
    }

    $folio = 'MB-' . strtoupper($vendedor_id) . '-' . str_pad((string)$nextSeq, 4, '0', STR_PAD_LEFT);

    $stmt = $pdo->prepare("
      INSERT INTO sales_quotes
        (token, folio, cliente_empresa, cliente_contacto, cliente_email,
         vendedor, vendedor_id, quote_json, total_mensual, notas, expires_at)
      VALUES
        (:token, :folio, :empresa, :contacto, :email,
         :vendedor, :vendedor_id, :json, :total, :notas,
         DATE_ADD(NOW(), INTERVAL 60 DAY))
    ");

    $stmt->execute([
      ':token'       => $token,
      ':folio'       => $folio,
      ':empresa'     => mb_substr((string)($data['empresa']  ?? ''), 0, 120),
      ':contacto'    => mb_substr((string)($data['contacto'] ?? ''), 0, 120),
      ':email'       => mb_substr((string)($data['email']    ?? ''), 0, 180),
      ':vendedor'    => mb_substr((string)($data['vendedor'] ?? ''), 0, 60),
      ':vendedor_id' => $vendedor_id,
      ':json'        => json_encode($data, JSON_UNESCAPED_UNICODE),
      ':total'       => (float)($data['total'] ?? 0),
      ':notas'       => mb_substr((string)($data['notas']    ?? ''), 0, 500),
    ]);

    $pdo->commit();
  } else {
    // Sin vendor ID válido: guardar sin folio
    $stmt = $pdo->prepare("
      INSERT INTO sales_quotes
        (token, cliente_empresa, cliente_contacto, cliente_email,
         vendedor, quote_json, total_mensual, notas, expires_at)
      VALUES
        (:token, :empresa, :contacto, :email,
         :vendedor, :json, :total, :notas,
         DATE_ADD(NOW(), INTERVAL 60 DAY))
    ");

    $stmt->execute([
      ':token'    => $token,
      ':empresa'  => mb_substr((string)($data['empresa']  ?? ''), 0, 120),
      ':contacto' => mb_substr((string)($data['contacto'] ?? ''), 0, 120),
      ':email'    => mb_substr((string)($data['email']    ?? ''), 0, 180),
      ':vendedor' => mb_substr((string)($data['vendedor'] ?? ''), 0, 60),
      ':json'     => json_encode($data, JSON_UNESCAPED_UNICODE),
      ':total'    => (float)($data['total'] ?? 0),
      ':notas'    => mb_substr((string)($data['notas']    ?? ''), 0, 500),
    ]);
  }

  // Guardar total_unico si existe
  $total_unico = isset($data['total_unico']) ? (float)$data['total_unico'] : null;
  if ($total_unico !== null && $total_unico > 0) {
    try {
      $upd = $pdo->prepare("UPDATE sales_quotes SET total_unico = ? WHERE token = ?");
      $upd->execute([$total_unico, $token]);
    } catch (Throwable $ignore) {}
  }

  echo json_encode(['ok' => true, 'token' => $token, 'folio' => $folio], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
  if (isset($pdo) && $pdo->inTransaction()) {
    $pdo->rollBack();
  }
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'DB error']);
}
