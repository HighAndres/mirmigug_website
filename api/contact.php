<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
  exit;
}

/* =========================
   CONFIG DB (TU HOSTING)
========================= */
define('DB_HOST', 'localhost');
define('DB_NAME', 'andres63_mirmibug_web');
define('DB_USER', 'andres63_adminmirmibug');
define('DB_PASS', 'ygKtYLN.I1g)');

/* =========================
   HELPERS
========================= */
function clean($s){ return trim((string)$s); }
function is_email($s){ return filter_var($s, FILTER_VALIDATE_EMAIL) !== false; }

/* =========================
   READ JSON (o fallback POST)
========================= */
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) $data = $_POST;

/* Honeypot anti-spam */
$honeypot = clean($data['website'] ?? '');
if ($honeypot !== '') { echo json_encode(['ok' => true]); exit; }

/* Inputs */
$nombre   = clean($data['nombre'] ?? '');
$email    = clean($data['email'] ?? '');
$telefono = clean($data['telefono'] ?? '');
$empresa  = clean($data['empresa'] ?? '');
$mensaje  = clean($data['mensaje'] ?? '');
$origen   = clean($data['origen'] ?? '');

/* Validate */
if ($nombre === '' || !is_email($email) || $mensaje === '') {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Datos inválidos']);
  exit;
}

/* Meta */
$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? ($_SERVER['REMOTE_ADDR'] ?? '');
if (strpos($ip, ',') !== false) $ip = trim(explode(',', $ip)[0]);
$user_agent = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
$user_agent = $user_agent !== '' ? mb_substr($user_agent, 0, 255) : '';

/* =========================
   INSERT DB (contact_leads)
========================= */
try {
  $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
  $pdo = new PDO($dsn, DB_USER, DB_PASS, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
  ]);

  $stmt = $pdo->prepare("
    INSERT INTO contact_leads (nombre, email, telefono, empresa, mensaje, origen, ip, user_agent)
    VALUES (:nombre, :email, :telefono, :empresa, :mensaje, :origen, :ip, :user_agent)
  ");

  $stmt->execute([
    ':nombre' => mb_substr($nombre, 0, 120),
    ':email' => mb_substr(strtolower($email), 0, 180),
    ':telefono' => ($telefono !== '' ? mb_substr($telefono, 0, 40) : null),
    ':empresa' => ($empresa !== '' ? mb_substr($empresa, 0, 160) : null),
    ':mensaje' => $mensaje,
    ':origen' => ($origen !== '' ? mb_substr($origen, 0, 255) : null),
    ':ip' => ($ip !== '' ? mb_substr($ip, 0, 45) : null),
    ':user_agent' => ($user_agent !== '' ? $user_agent : null),
  ]);

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'DB error']);
  exit;
}

/* =========================
   EMAIL (mail)
========================= */
$to = 'contacto@mirmibug.com';
$from = 'no-reply@mirmibug.com';
$subjectPlain = "Nuevo contacto - $nombre";
$subject = '=?UTF-8?B?' . base64_encode($subjectPlain) . '?=';

$body = "Nuevo mensaje desde el formulario:\n\n"
  . "Nombre: $nombre\n"
  . "Email: $email\n"
  . "Teléfono: " . ($telefono ?: '-') . "\n"
  . "Empresa: " . ($empresa ?: '-') . "\n\n"
  . "Mensaje:\n$mensaje\n\n"
  . "Origen: " . ($origen ?: '-') . "\n"
  . "IP: " . ($ip ?: '-') . "\n";

$headers = "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
$headers .= "From: Mirmibug <{$from}>\r\n";
$headers .= "Reply-To: {$nombre} <{$email}>\r\n";

$sent = @mail($to, $subject, $body, $headers);

/* OK */
echo json_encode(['ok' => true, 'mail_sent' => (bool)$sent]);
