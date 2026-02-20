<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
  exit;
}

/* =========================
   CONFIG DB
========================= */
define('DB_HOST', 'localhost');
define('DB_NAME', 'andres63_mirmibug_web');
define('DB_USER', 'andres63_adminmirmibug');
define('DB_PASS', 'ygKtYLN.I1g)');

/* =========================
   CONFIG EMAIL (TITAN)
   - Prueba primero 465 (SSL)
   - Si falla, cambia a 587 + STARTTLS (abajo te digo)
========================= */
define('SMTP_HOST', 'smtp.titan.email');
define('SMTP_PORT', 465); 
define('SMTP_USER', 'contacto@mirmibug.com');
define('SMTP_PASS', '67]}GI[?gH05'); 
define('MAIL_TO',   'contacto@mirmibug.com');

/* =========================
   LOG
========================= */
define('LOG_FILE', __DIR__ . '/contact.log');

function clean($s): string { return trim((string)$s); }
function is_email($s): bool { return filter_var($s, FILTER_VALIDATE_EMAIL) !== false; }
function log_line(string $msg): void {
  @file_put_contents(LOG_FILE, '[' . date('Y-m-d H:i:s') . '] ' . $msg . PHP_EOL, FILE_APPEND);
}

/* =========================
   INPUT
   (tu JS manda urlencoded/FormData => $_POST)
========================= */
$data = $_POST;

$nombre  = clean($data['nombre'] ?? '');
$email   = clean($data['email'] ?? '');
$telefono= clean($data['telefono'] ?? '');
$empresa = clean($data['empresa'] ?? '');
$mensaje = clean($data['mensaje'] ?? '');
$origen  = clean($data['origen'] ?? '');
$honeypot= clean($data['website'] ?? '');

$consentimiento = !empty($data['consentimiento']) ? 1 : 0;

// Honeypot anti-spam
if ($honeypot !== '') {
  echo json_encode(['ok' => true, 'saved' => false, 'email_ok' => false], JSON_UNESCAPED_UNICODE);
  exit;
}

// Validación mínima
if ($nombre === '' || !is_email($email) || $mensaje === '') {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Invalid data'], JSON_UNESCAPED_UNICODE);
  exit;
}

// IP / UA
$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
if (strpos($ip, ',') !== false) $ip = trim(explode(',', $ip)[0]);

$user_agent = $_SERVER['HTTP_USER_AGENT'] ?? '';
$user_agent = $user_agent !== '' ? substr($user_agent, 0, 255) : null;

/* =========================
   1) INSERT DB
========================= */
try {
  $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
  $pdo = new PDO($dsn, DB_USER, DB_PASS, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
  ]);

  $stmt = $pdo->prepare("
    INSERT INTO contact_leads
      (nombre, email, telefono, empresa, mensaje, origen, ip, user_agent, consentimiento)
    VALUES
      (:nombre, :email, :telefono, :empresa, :mensaje, :origen, :ip, :user_agent, :consentimiento)
  ");

  $stmt->execute([
    ':nombre' => $nombre,
    ':email' => strtolower($email),
    ':telefono' => ($telefono !== '' ? $telefono : null),
    ':empresa' => ($empresa !== '' ? $empresa : null),
    ':mensaje' => $mensaje,
    ':origen' => ($origen !== '' ? $origen : null),
    ':ip' => ($ip !== '' ? $ip : null),
    ':user_agent' => $user_agent,
    ':consentimiento' => $consentimiento
  ]);

} catch (Throwable $e) {
  log_line('DB ERROR: ' . $e->getMessage());
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'DB error'], JSON_UNESCAPED_UNICODE);
  exit;
}

/* =========================
   2) SEND EMAIL (PHPMailer)
========================= */
$email_ok = false;
$email_error = null;

try {
  // ✅ TU PROYECTO TIENE /api/mailer/
  require_once __DIR__ . '/mailer/Exception.php';
  require_once __DIR__ . '/mailer/PHPMailer.php';
  require_once __DIR__ . '/mailer/SMTP.php';

  $mail = new PHPMailer\PHPMailer\PHPMailer(true);
  $mail->CharSet = 'UTF-8';

  $mail->isSMTP();
  $mail->Host = SMTP_HOST;
  $mail->SMTPAuth = true;
  $mail->Username = SMTP_USER;
  $mail->Password = SMTP_PASS;
  $mail->Port = SMTP_PORT;

  // ✅ 465 => SSL
  $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;

  // (Opcional) Debug a log del servidor (descomenta si lo necesitas)
  // $mail->SMTPDebug = 2;
  // $mail->Debugoutput = function($str, $level) { error_log("SMTP[$level]: $str"); };

  $mail->setFrom(SMTP_USER, 'Mirmibug Web');
  $mail->addAddress(MAIL_TO, 'Contacto Mirmibug');
  $mail->addReplyTo($email, $nombre);

  $mail->Subject = "Nuevo contacto web - {$nombre}";
  $mail->Body =
    "Nuevo contacto recibido:\n\n" .
    "Nombre: {$nombre}\n" .
    "Email: {$email}\n" .
    "Teléfono: " . ($telefono ?: '-') . "\n" .
    "Empresa: " . ($empresa ?: '-') . "\n\n" .
    "Mensaje:\n{$mensaje}\n\n" .
    "Origen: " . ($origen ?: '-') . "\n" .
    "IP: " . ($ip ?: '-') . "\n" .
    "User-Agent: " . ($user_agent ?: '-') . "\n";

  $mail->send();
  $email_ok = true;

} catch (Throwable $e) {
  $email_ok = false;
  $email_error = $e->getMessage();
  log_line('MAIL ERROR: ' . $email_error);
}

echo json_encode([
  'ok' => true,
  'saved' => true,
  'email_ok' => $email_ok,
  'email_error' => $email_ok ? null : $email_error
], JSON_UNESCAPED_UNICODE);