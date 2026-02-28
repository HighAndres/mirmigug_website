<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: https://mirmibug.com');

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

  $stmt = $pdo->prepare("
    INSERT INTO sales_quotes
      (token, cliente_empresa, cliente_contacto, cliente_email, vendedor, quote_json, total_mensual, notas, expires_at)
    VALUES
      (:token, :empresa, :contacto, :email, :vendedor, :json, :total, :notas, DATE_ADD(NOW(), INTERVAL 60 DAY))
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

  echo json_encode(['ok' => true, 'token' => $token], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'DB error']);
}
