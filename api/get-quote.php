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

require_once __DIR__ . '/config.php';

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
    SELECT quote_json, folio, vendedor_id FROM sales_quotes
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
  $quote['folio']       = $row['folio'];
  $quote['vendedor_id'] = $row['vendedor_id'];
  echo json_encode(['ok' => true, 'quote' => $quote], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'DB error']);
}
