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
  header('Access-Control-Allow-Headers: Content-Type, X-Admin-Token');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';

try {
  $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
  $pdo = new PDO($dsn, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

  $pdo->exec("CREATE TABLE IF NOT EXISTS company_config (
    cfg_key   VARCHAR(80)  NOT NULL PRIMARY KEY,
    cfg_value TEXT,
    updated_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

  switch ($action) {

    // ══════════════════════════════════
    // GET_COMPANY — datos de la empresa (público)
    // ══════════════════════════════════
    case 'get_company':
      $stmt = $pdo->query("SELECT cfg_key, cfg_value FROM company_config WHERE cfg_key NOT IN ('price_overrides')");
      $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
      $config = [];
      foreach ($rows as $r) $config[$r['cfg_key']] = $r['cfg_value'];
      echo json_encode(['ok' => true, 'config' => $config], JSON_UNESCAPED_UNICODE);
      break;

    // ══════════════════════════════════
    // SAVE_COMPANY — guardar datos empresa (solo admin)
    // POST { rfc, address, clabe, bank, bank_titular, phone, terms, max_discount }
    // ══════════════════════════════════
    case 'save_company':
      requireAdmin($pdo);
      requirePost();

      $data    = json_decode(file_get_contents('php://input'), true);
      $allowed = ['rfc', 'address', 'clabe', 'bank', 'bank_titular', 'phone', 'terms', 'max_discount'];

      $stmt = $pdo->prepare("INSERT INTO company_config (cfg_key, cfg_value) VALUES (?,?) ON DUPLICATE KEY UPDATE cfg_value=?, updated_at=NOW()");
      foreach ($allowed as $key) {
        if (array_key_exists($key, $data)) {
          $val = mb_substr((string)$data[$key], 0, 1000);
          $stmt->execute([$key, $val, $val]);
        }
      }
      echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
      break;

    // ══════════════════════════════════
    // GET_PRICES — precios de servicios/equipos (público)
    // ══════════════════════════════════
    case 'get_prices':
      $stmt = $pdo->prepare("SELECT cfg_value FROM company_config WHERE cfg_key = 'price_overrides'");
      $stmt->execute();
      $val = $stmt->fetchColumn();
      $overrides = ($val !== false) ? json_decode($val, true) : null;
      echo json_encode(['ok' => true, 'prices' => $overrides ?: (object)[]], JSON_UNESCAPED_UNICODE);
      break;

    // ══════════════════════════════════
    // SAVE_PRICES — guardar precios (solo admin)
    // POST { services: { id: { base, varRate, hourlyRate } }, equip: { id: { defaultPrice } } }
    // ══════════════════════════════════
    case 'save_prices':
      requireAdmin($pdo);
      requirePost();

      $data = json_decode(file_get_contents('php://input'), true);
      if (!is_array($data)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'JSON inválido']);
        exit;
      }

      // Sanitize: only allow numeric price values
      $clean = ['services' => [], 'equip' => []];
      foreach ($data['services'] ?? [] as $id => $prices) {
        if (is_string($id) && preg_match('/^[a-z_]{1,30}$/', $id)) {
          $clean['services'][$id] = [
            'base'        => max(0, (float)($prices['base']        ?? 0)),
            'varRate'     => max(0, (float)($prices['varRate']     ?? 0)),
            'hourlyRate'  => max(0, (float)($prices['hourlyRate']  ?? 0)),
          ];
        }
      }
      foreach ($data['equip'] ?? [] as $id => $prices) {
        if (is_string($id) && preg_match('/^[a-z_]{1,30}$/', $id)) {
          $clean['equip'][$id] = [
            'defaultPrice' => max(0, (float)($prices['defaultPrice'] ?? 0)),
          ];
        }
      }

      $json = json_encode($clean);
      $stmt = $pdo->prepare("INSERT INTO company_config (cfg_key, cfg_value) VALUES ('price_overrides',?) ON DUPLICATE KEY UPDATE cfg_value=?, updated_at=NOW()");
      $stmt->execute([$json, $json]);
      echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
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
 * Validates admin token against DB (stateless — no sessions needed).
 * Supports both X-Admin-Token header and legacy PHP session.
 */
function requireAdmin(PDO $pdo): void {
  $token = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
  if ($token === '') {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'No autorizado']);
    exit;
  }

  // DB-based validation (stateless)
  $stmt = $pdo->prepare("SELECT id FROM sales_vendors WHERE admin_token = ? AND role = 'admin' AND active = 1");
  $stmt->execute([$token]);
  if (!$stmt->fetch()) {
    // Fallback: session-based validation (legacy)
    @session_start();
    if (!isset($_SESSION['admin_token']) || $token !== $_SESSION['admin_token']) {
      http_response_code(403);
      echo json_encode(['ok' => false, 'error' => 'No autorizado']);
      exit;
    }
  }
}

function requirePost(): void {
  if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'POST required']);
    exit;
  }
}
