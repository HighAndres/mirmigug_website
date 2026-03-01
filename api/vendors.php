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
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

require_once __DIR__ . '/config.php';

// ── Tokens de admin en memoria (sesión PHP) ──
session_start();

$action = $_GET['action'] ?? '';

try {
  $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
  $pdo = new PDO($dsn, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

  switch ($action) {

    // ══════════════════════════════════
    // SETUP — ejecutar UNA vez para crear el admin inicial
    // Visitar: api/vendors.php?action=setup
    // ══════════════════════════════════
    case 'setup':
      // Verificar que no existan vendedores aún
      $count = (int) $pdo->query("SELECT COUNT(*) FROM sales_vendors")->fetchColumn();
      if ($count > 0) {
        echo json_encode(['ok' => false, 'error' => 'Ya existen vendedores. Setup solo funciona con tabla vacía.']);
        exit;
      }

      $hash = password_hash('mirmi2026', PASSWORD_DEFAULT);
      $stmt = $pdo->prepare("
        INSERT INTO sales_vendors (vendor_id, name, pin_hash, role)
        VALUES ('V001', 'Andres', ?, 'admin')
      ");
      $stmt->execute([$hash]);
      echo json_encode(['ok' => true, 'message' => 'Admin V001 (Andres) creado. Cambia el PIN desde el panel admin.']);
      break;

    // ══════════════════════════════════
    // LOGIN — validar PIN server-side
    // POST { pin }
    // ══════════════════════════════════
    case 'login':
      if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'POST required']);
        exit;
      }

      $data = json_decode(file_get_contents('php://input'), true);
      $pin  = trim((string)($data['pin'] ?? ''));

      if ($pin === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'PIN requerido']);
        exit;
      }

      // Buscar todos los vendedores activos y verificar PIN
      $stmt = $pdo->prepare("SELECT vendor_id, name, pin_hash, role FROM sales_vendors WHERE active = 1");
      $stmt->execute();
      $vendors = $stmt->fetchAll(PDO::FETCH_ASSOC);

      $matched = null;
      foreach ($vendors as $v) {
        if (password_verify($pin, $v['pin_hash'])) {
          $matched = $v;
          break;
        }
      }

      if (!$matched) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'PIN incorrecto']);
        exit;
      }

      $response = [
        'ok'   => true,
        'user' => [
          'id'   => $matched['vendor_id'],
          'name' => $matched['name'],
          'role' => $matched['role'],
        ],
      ];

      // Si es admin, generar token temporal
      if ($matched['role'] === 'admin') {
        $adminToken = bin2hex(random_bytes(16));
        $_SESSION['admin_token'] = $adminToken;
        $_SESSION['admin_vendor_id'] = $matched['vendor_id'];
        $response['admin_token'] = $adminToken;
      }

      echo json_encode($response, JSON_UNESCAPED_UNICODE);
      break;

    // ══════════════════════════════════
    // LIST — listar vendedores (solo admin)
    // GET
    // ══════════════════════════════════
    case 'list':
      requireAdmin();
      $stmt = $pdo->query("SELECT vendor_id, name, role, active, created_at FROM sales_vendors ORDER BY vendor_id");
      $vendors = $stmt->fetchAll(PDO::FETCH_ASSOC);
      echo json_encode(['ok' => true, 'vendors' => $vendors], JSON_UNESCAPED_UNICODE);
      break;

    // ══════════════════════════════════
    // CREATE — crear vendedor (solo admin)
    // POST { name, pin }
    // ══════════════════════════════════
    case 'create':
      requireAdmin();
      requirePost();

      $data = json_decode(file_get_contents('php://input'), true);
      $name = trim((string)($data['name'] ?? ''));
      $pin  = trim((string)($data['pin']  ?? ''));

      if ($name === '' || $pin === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Nombre y PIN requeridos']);
        exit;
      }

      if (mb_strlen($pin) < 4) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'PIN debe tener al menos 4 caracteres']);
        exit;
      }

      // Auto-generar siguiente vendor_id
      $lastId = $pdo->query("SELECT vendor_id FROM sales_vendors ORDER BY id DESC LIMIT 1")->fetchColumn();
      if ($lastId && preg_match('/V(\d+)/', $lastId, $m)) {
        $nextNum = intval($m[1]) + 1;
      } else {
        $nextNum = 1;
      }
      $vendorId = 'V' . str_pad((string)$nextNum, 3, '0', STR_PAD_LEFT);

      $hash = password_hash($pin, PASSWORD_DEFAULT);
      $stmt = $pdo->prepare("INSERT INTO sales_vendors (vendor_id, name, pin_hash) VALUES (?, ?, ?)");
      $stmt->execute([$vendorId, mb_substr($name, 0, 60), $hash]);

      echo json_encode(['ok' => true, 'vendor_id' => $vendorId, 'name' => $name], JSON_UNESCAPED_UNICODE);
      break;

    // ══════════════════════════════════
    // UPDATE_PIN — cambiar PIN (solo admin)
    // POST { vendor_id, new_pin }
    // ══════════════════════════════════
    case 'update_pin':
      requireAdmin();
      requirePost();

      $data   = json_decode(file_get_contents('php://input'), true);
      $vid    = trim((string)($data['vendor_id'] ?? ''));
      $newPin = trim((string)($data['new_pin']   ?? ''));

      if ($vid === '' || $newPin === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'vendor_id y new_pin requeridos']);
        exit;
      }

      if (mb_strlen($newPin) < 4) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'PIN debe tener al menos 4 caracteres']);
        exit;
      }

      $hash = password_hash($newPin, PASSWORD_DEFAULT);
      $stmt = $pdo->prepare("UPDATE sales_vendors SET pin_hash = ? WHERE vendor_id = ?");
      $stmt->execute([$hash, $vid]);

      if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'Vendedor no encontrado']);
        exit;
      }

      echo json_encode(['ok' => true, 'message' => 'PIN actualizado'], JSON_UNESCAPED_UNICODE);
      break;

    // ══════════════════════════════════
    // TOGGLE — activar/desactivar (solo admin)
    // POST { vendor_id }
    // ══════════════════════════════════
    case 'toggle':
      requireAdmin();
      requirePost();

      $data = json_decode(file_get_contents('php://input'), true);
      $vid  = trim((string)($data['vendor_id'] ?? ''));

      if ($vid === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'vendor_id requerido']);
        exit;
      }

      // No permitir desactivar al propio admin
      if ($vid === ($_SESSION['admin_vendor_id'] ?? '')) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'No puedes desactivarte a ti mismo']);
        exit;
      }

      $stmt = $pdo->prepare("UPDATE sales_vendors SET active = NOT active WHERE vendor_id = ?");
      $stmt->execute([$vid]);

      if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'Vendedor no encontrado']);
        exit;
      }

      // Obtener nuevo estado
      $st = $pdo->prepare("SELECT active FROM sales_vendors WHERE vendor_id = ?");
      $st->execute([$vid]);
      $newActive = (bool)$st->fetchColumn();

      echo json_encode(['ok' => true, 'vendor_id' => $vid, 'active' => $newActive], JSON_UNESCAPED_UNICODE);
      break;

    // ══════════════════════════════════
    // DELETE — eliminar vendedor (solo admin)
    // POST { vendor_id }
    // ══════════════════════════════════
    case 'delete':
      requireAdmin();
      requirePost();

      $data = json_decode(file_get_contents('php://input'), true);
      $vid  = trim((string)($data['vendor_id'] ?? ''));

      if ($vid === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'vendor_id requerido']);
        exit;
      }

      // No permitir eliminar al propio admin
      if ($vid === ($_SESSION['admin_vendor_id'] ?? '')) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'No puedes eliminarte a ti mismo']);
        exit;
      }

      $stmt = $pdo->prepare("DELETE FROM sales_vendors WHERE vendor_id = ?");
      $stmt->execute([$vid]);

      if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'Vendedor no encontrado']);
        exit;
      }

      echo json_encode(['ok' => true, 'message' => 'Vendedor eliminado'], JSON_UNESCAPED_UNICODE);
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

function requireAdmin(): void {
  $token = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
  if ($token === '' || !isset($_SESSION['admin_token']) || $token !== $_SESSION['admin_token']) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'No autorizado']);
    exit;
  }
}

function requirePost(): void {
  if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'POST required']);
    exit;
  }
}
