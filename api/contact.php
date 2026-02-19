<?php
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
  exit;
}

define('DB_HOST', 'localhost');
define('DB_NAME', 'andres63_web');
define('DB_USER', 'andres63_admin');
define('DB_PASS', 'kToVk,GgZBKb');

function clean($s){ return trim((string)$s); }
function is_email($s){ return filter_var($s, FILTER_VALIDATE_EMAIL) !== false; }

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) $data = $_POST;

$nombre = clean($data['nombre'] ?? '');
$email  = clean($data['email'] ?? '');
$telefono = clean($data['telefono'] ?? '');
$empresa  = clean($data['empresa'] ?? '');
$mensaje  = clean($data['mensaje'] ?? '');
$consentimiento = !empty($data['consentimiento']) ? 1 : 0;
$origen = clean($data['origen'] ?? '');
$honeypot = clean($data['website'] ?? '');

if ($honeypot !== '') { echo json_encode(['ok'=>true]); exit; }

if ($nombre === '' || !is_email($email) || $mensaje === '') {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Datos inválidos']);
  exit;
}

$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
if (strpos($ip, ',') !== false) $ip = trim(explode(',', $ip)[0]);
$user_agent = $_SERVER['HTTP_USER_AGENT'] ?? '';

try {
  $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
  $pdo = new PDO($dsn, DB_USER, DB_PASS, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
  ]);

  $stmt = $pdo->prepare("
    INSERT INTO leads (nombre, email, telefono, empresa, mensaje, origen, ip, user_agent, consentimiento)
    VALUES (:nombre, :email, :telefono, :empresa, :mensaje, :origen, :ip, :user_agent, :consentimiento)
  ");

  $stmt->execute([
    ':nombre' => $nombre,
    ':email' => strtolower($email),
    ':telefono' => $telefono !== '' ? $telefono : null,
    ':empresa' => $empresa !== '' ? $empresa : null,
    ':mensaje' => $mensaje,
    ':origen' => $origen !== '' ? $origen : null,
    ':ip' => $ip !== '' ? $ip : null,
    ':user_agent' => $user_agent !== '' ? substr($user_agent, 0, 255) : null,
    ':consentimiento' => $consentimiento
  ]);

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'DB error']);
  exit;
}

// Envío de correo simple
$to = 'info@mirmibug.com';
$from = 'no-reply@mirmibug.com';
$subject = "Nuevo contacto - $nombre";
$body = "Nombre: $nombre\nEmail: $email\nTeléfono: ".($telefono?:'-')."\nEmpresa: ".($empresa?:'-')."\n\nMensaje:\n$mensaje\n\nOrigen: ".($origen?:'-')."\nIP: ".($ip?:'-')."\n";

$headers = "From: Mirmibug <$from>\r\n";
$headers .= "Reply-To: $email\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

@mail($to, $subject, $body, $headers);

echo json_encode(['ok' => true]);
