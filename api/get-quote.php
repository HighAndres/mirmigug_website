<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: https://mirmibug.com');

define('DB_HOST', 'localhost');
define('DB_NAME', 'andres63_mirmibug_web');
define('DB_USER', 'andres63_adminmirmibug');
define('DB_PASS', 'ygKtYLN.I1g)');

$token = trim((string)($_GET['token'] ?? ''));

// Validar token: exactamente 16 hex
if (strlen($token) !== 16 || !ctype_xdigit($token)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Token inválido']);
  exit;
}

try {
  $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
  $pdo = new PDO($dsn, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

  $stmt = $pdo->prepare("
    SELECT quote_json FROM sales_quotes
    WHERE token = ? AND (expires_at IS NULL OR expires_at > NOW())
  ");
  $stmt->execute([$token]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$row) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'Propuesta no encontrada o expirada']);
    exit;
  }

  $quote = json_decode($row['quote_json'], true);
  echo json_encode(['ok' => true, 'quote' => $quote], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'DB error']);
}
