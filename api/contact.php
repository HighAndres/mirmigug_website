<?php
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
  exit;
}

/* =========================
<<<<<<< HEAD
   DB CONFIG
=======
   CONFIG DB (TU DATA)
>>>>>>> ba66f52 (Actualización en contact.php (SMTP o mejoras))
========================= */
define('DB_HOST', 'localhost');
define('DB_NAME', 'andres63_mirmibug_web');
define('DB_USER', 'andres63_adminmirmibug');
<<<<<<< HEAD
define('DB_PASS', 'ygKtYLN.I1g)');

/* =========================
   TITAN SMTP CONFIG (no-reply)
========================= */
define('SMTP_HOST', 'smtp.titan.email');
define('SMTP_PORT', 587);
define('SMTP_SECURE', 'tls'); // tls = STARTTLS (587)

// Si 587 no funciona, usa 465 SSL:
// define('SMTP_PORT', 465);
// define('SMTP_SECURE', 'ssl');

define('SMTP_USER', 'no-reply@mirmibug.com');
define('SMTP_PASS', 'PON_AQUI_PASS'); // <-- pega tu contraseña aquí en tu editor

define('MAIL_TO', 'contacto@mirmibug.com');
=======
define('DB_PASS', 'ygKtYLN.I1g)'); // tu pass real

/* =========================
   CONFIG EMAIL (HOSTGATOR / FLOCKMAIL)
   (TU LOG DICE smtp-out.flockmail.com)
========================= */
define('SMTP_HOST', 'smtp-out.flockmail.com');
define('SMTP_PORT', 587); // STARTTLS
define('SMTP_USER', 'contacto@mirmibug.com');
define('SMTP_PASS', '67]}GI[?gH05'); // <<<<< CAMBIA ESTO
define('MAIL_TO',   'contacto@mirmibug.com');
>>>>>>> ba66f52 (Actualización en contact.php (SMTP o mejoras))

define('LOG_FILE', __DIR__ . '/contact.log');

/* =========================
   HELPERS
========================= */
function clean($s): string { return trim((string)$s); }
function is_email($s): bool { return filter_var($s, FILTER_VALIDATE_EMAIL) !== false; }
function log_line(string $msg): void {
  @file_put_contents(LOG_FILE, '['.date('Y-m-d H:i:s').'] '.$msg.PHP_EOL, FILE_APPEND);
}

/* =========================
<<<<<<< HEAD
   INPUT
========================= */
$nombre   = clean($_POST['nombre'] ?? '');
$email    = clean($_POST['email'] ?? '');
$telefono = clean($_POST['telefono'] ?? '');
$empresa  = clean($_POST['empresa'] ?? '');
$mensaje  = clean($_POST['mensaje'] ?? '');
$origen   = clean($_POST['origen'] ?? '');
$honeypot = clean($_POST['website'] ?? '');
=======
   INPUT (FORM DATA)
   Tu JS debe mandar FormData o x-www-form-urlencoded
========================= */
$data = $_POST;

$nombre = clean($data['nombre'] ?? '');
$email  = clean($data['email'] ?? '');
$telefono = clean($data['telefono'] ?? '');
$empresa  = clean($data['empresa'] ?? '');
$mensaje  = clean($data['mensaje'] ?? '');
$consentimiento = !empty($data['consentimiento']) ? 1 : 0;
$origen = clean($data['origen'] ?? '');
$honeypot = clean($data['website'] ?? '');
>>>>>>> ba66f52 (Actualización en contact.php (SMTP o mejoras))

if ($honeypot !== '') {
  echo json_encode(['ok' => true, 'saved' => false, 'email_ok' => false], JSON_UNESCAPED_UNICODE);
  exit;
}

if ($nombre === '' || !is_email($email) || $mensaje === '') {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Invalid data'], JSON_UNESCAPED_UNICODE);
  exit;
}

/* =========================
   META (IP + USER AGENT)
========================= */
$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
if (strpos($ip, ',') !== false) $ip = trim(explode(',', $ip)[0]);
$ip = $ip !== '' ? $ip : null;

$user_agent = $_SERVER['HTTP_USER_AGENT'] ?? '';
$user_agent = $user_agent !== '' ? substr($user_agent, 0, 255) : null;

/* =========================
   1) SAVE TO DB
========================= */
$saved = false;

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
    ':nombre'     => $nombre,
    ':email'      => strtolower($email),
    ':telefono'   => ($telefono !== '' ? $telefono : null),
    ':empresa'    => ($empresa !== '' ? $empresa : null),
    ':mensaje'    => $mensaje,
    ':origen'     => ($origen !== '' ? $origen : null),
    ':ip'         => $ip,
    ':user_agent' => $user_agent,
    ':consentimiento' => $consentimiento
  ]);

  $saved = true;

} catch (Throwable $e) {
  log_line('DB ERROR: ' . $e->getMessage());
  http_response_code(500);
  echo json_encode(['ok' => false, 'saved' => false, 'error' => 'DB error'], JSON_UNESCAPED_UNICODE);
  exit;
}

/* =========================
   2) SEND EMAIL (PHPMailer SMTP)
========================= */
$email_ok = false;
$email_error = null;

try {
  // RUTAS: asegúrate que existen así:
  // /public_html/api/mailer/PHPMailer.php
  // /public_html/api/mailer/SMTP.php
  // /public_html/api/mailer/Exception.php
  require_once __DIR__ . '/mailer/Exception.php';
  require_once __DIR__ . '/mailer/PHPMailer.php';
  require_once __DIR__ . '/mailer/SMTP.php';

  $mail = new PHPMailer(true);
  $mail->CharSet = 'UTF-8';

  // Debug (si lo necesitas)
  // $mail->SMTPDebug = 2;
  // $mail->Debugoutput = function($str, $level) { error_log("SMTP[$level]: $str"); };

  $mail->isSMTP();
  $mail->Host = SMTP_HOST;
  $mail->SMTPAuth = true;
  $mail->AuthType = 'LOGIN';
  $mail->Username = SMTP_USER;
  $mail->Password = SMTP_PASS;
  $mail->Port = SMTP_PORT;
  $mail->Timeout = 25;

  // STARTTLS en 587 (lo que tu servidor ofreció en el log)
  $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;

<<<<<<< HEAD
  // DEBUG a log (cuando funcione, vuelve a 0)
  $mail->SMTPDebug = 2;
  $mail->Debugoutput = function($str, $level) {
    log_line("SMTP[$level]: $str");
  };

  // From debe ser el buzón autenticado (no-reply)
=======
  // Recomendado en hosting compartido
>>>>>>> ba66f52 (Actualización en contact.php (SMTP o mejoras))
  $mail->setFrom(SMTP_USER, 'Mirmibug Web');

  // Destino final
  $mail->addAddress(MAIL_TO, 'Contacto Mirmibug');

  // Para que al responder te responda al cliente
  $mail->addReplyTo($email, $nombre);

<<<<<<< HEAD
  $mail->Subject = "Nuevo contacto - {$nombre}";
=======
  $mail->Subject = "Nuevo contacto web - {$nombre}";
>>>>>>> ba66f52 (Actualización en contact.php (SMTP o mejoras))
  $mail->Body =
    "Nuevo contacto recibido:\n\n" .
    "Nombre: {$nombre}\n" .
    "Email: {$email}\n" .
    "Teléfono: " . ($telefono ?: '-') . "\n" .
    "Empresa: " . ($empresa ?: '-') . "\n\n" .
    "Mensaje:\n{$mensaje}\n\n" .
    "Origen: " . ($origen ?: '-') . "\n" .
<<<<<<< HEAD
    "IP: " . ($ip ?: '-') . "\n" .
    "User-Agent: " . ($user_agent ?: '-') . "\n";
=======
    "IP: " . ($ip ?: '-') . "\n";
>>>>>>> ba66f52 (Actualización en contact.php (SMTP o mejoras))

  $mail->send();
  $email_ok = true;

} catch (Throwable $e) {
  $email_ok = false;
  $email_error = $e->getMessage();
  log_line('MAIL ERROR: ' . $email_error);
}

echo json_encode([
  'ok' => true,
  'saved' => $saved,
  'email_ok' => $email_ok,
  'email_error' => $email_ok ? null : $email_error
], JSON_UNESCAPED_UNICODE);