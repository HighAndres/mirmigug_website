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
  header('Access-Control-Allow-Methods: GET, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type, X-Vendor-Token, X-Admin-Token');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/config.php';
@session_start();

$action = $_GET['action'] ?? 'list';

try {
  $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
  $pdo = new PDO($dsn, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

  switch ($action) {

    // ══════════════════════════════════
    // LIST — historial de cotizaciones del vendedor (o todas si es admin)
    // GET — requiere X-Vendor-Token
    // ══════════════════════════════════
    case 'list':
      $vendorId = requireVendor();
      $isAdmin  = isAdminSession();

      if ($isAdmin) {
        $stmt = $pdo->prepare("
          SELECT token, folio, cliente_empresa, cliente_contacto, cliente_email,
                 vendedor, vendedor_id, total_mensual, total_unico, notas,
                 created_at, expires_at
          FROM sales_quotes
          ORDER BY created_at DESC
          LIMIT 200
        ");
        $stmt->execute();
      } else {
        $stmt = $pdo->prepare("
          SELECT token, folio, cliente_empresa, cliente_contacto, cliente_email,
                 vendedor, vendedor_id, total_mensual, total_unico, notas,
                 created_at, expires_at
          FROM sales_quotes
          WHERE vendedor_id = ?
          ORDER BY created_at DESC
          LIMIT 100
        ");
        $stmt->execute([$vendorId]);
      }

      $quotes = $stmt->fetchAll(PDO::FETCH_ASSOC);
      echo json_encode(['ok' => true, 'quotes' => $quotes], JSON_UNESCAPED_UNICODE);
      break;

    default:
      http_response_code(400);
      echo json_encode(['ok' => false, 'error' => 'Acción no válida']);
  }

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Error del servidor']);
}

// ── Helpers ──

/**
 * Validates vendor token against DB (stateless).
 * Falls back to session if DB column not yet migrated.
 * Returns vendor_id on success, exits with 403 on failure.
 */
function requireVendor(): string {
  global $pdo;
  $token = $_SERVER['HTTP_X_VENDOR_TOKEN'] ?? '';
  if ($token === '') {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'No autorizado — inicia sesión de nuevo']);
    exit;
  }

  // DB-based validation (stateless)
  try {
    $colCheck = $pdo->query("SHOW COLUMNS FROM sales_vendors LIKE 'vendor_token'");
    if ($colCheck->rowCount() > 0) {
      $stmt = $pdo->prepare("SELECT vendor_id FROM sales_vendors WHERE vendor_token = ? AND active = 1");
      $stmt->execute([$token]);
      $row = $stmt->fetch(PDO::FETCH_ASSOC);
      if ($row) return (string)$row['vendor_id'];
    }
  } catch (Throwable $ignore) {}

  // Fallback: session-based validation (legacy)
  if (!isset($_SESSION['vendor_token']) || $token !== $_SESSION['vendor_token']) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'No autorizado — inicia sesión de nuevo']);
    exit;
  }
  return (string)($_SESSION['vendor_id'] ?? '');
}

/**
 * Checks if the request has a valid admin token.
 * Checks DB first, then falls back to session.
 */
function isAdminSession(): bool {
  global $pdo;
  $adminToken = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
  if ($adminToken === '') return false;

  // DB-based check
  try {
    $colCheck = $pdo->query("SHOW COLUMNS FROM sales_vendors LIKE 'admin_token'");
    if ($colCheck->rowCount() > 0) {
      $stmt = $pdo->prepare("SELECT id FROM sales_vendors WHERE admin_token = ? AND role = 'admin' AND active = 1");
      $stmt->execute([$adminToken]);
      if ($stmt->fetch()) return true;
    }
  } catch (Throwable $ignore) {}

  // Fallback: session
  return isset($_SESSION['admin_token']) && $adminToken === $_SESSION['admin_token'];
}
