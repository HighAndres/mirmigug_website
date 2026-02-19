<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
  exit;
}

/* =========================
   CONFIG DB (TU DATA)
========================= */
define('DB_HOST', 'localhost');
define('DB_NAME', 'andres63_mirmibug_web');
define('DB_USER', 'andres63_adminmirmibug');
define('DB_PASS', 'ygKtYLN.I1g)');

/* =========================
   CONFIG EMAIL (TITAN SMTP)
========================= */
define('MAIL_TO', 'contacto@mirmibug.com');
define('MAIL_FROM', 'contacto@mirmibug.com');          // Debe existir
define('MAIL_FROM_NAME', 'Mirmibug');
define('SMTP_HOST', 'smtp.titan.email');
define('SMTP_USER', 'contacto@mirmibug.com');
define('SMTP_PASS', '67]}GI[?gH05');  

// 465 = SSL, 587 = STARTTLS
define('SMTP_PORT', 465);
define('SMTP_SECURE', 'ssl'); // 'ssl' (465) o 'tls' (587)

/* =========================
   PHPMailer includes
========================= */
$baseDir = __DIR__; // /public_html/api
require_once $baseDir . '/mailer/Exception.php';
require_once $baseDir . '/mailer/PHPMailer.php';
require_once $baseDir . '/mailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

/* =========================
   HELPERS
========================= */
function clean($s): string { return trim((string)$s); }
function is_email($s): bool { return filter_var($s, FILTER_VALIDATE_EMAIL) !== false; }

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
$honeypot = clean($data['website'] ?? ''); // anti-spam

// Honeypot
if ($honeypot !== '') { echo json_encode(['ok'=>true]); exit; }

// Validación mínima
if ($nombre === '' || !is_email($email) || $mensaje === '') {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Invalid data']);
  exit;
}

// IP / UA
$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
if (strpos($ip, ',') !== false) $ip = trim(explode(',', $ip)[0]);
$user_agent = $_SERVER['HTTP_USER_AGENT'] ?? '';
$user_agent = $user_agent !== '' ? substr($user_agent, 0, 255) : null;

/* =========================
   DB INSERT
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
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'DB error']);
  exit;
}

/* =========================
   EMAIL NOTIFY (SMTP)
========================= */
$mailOk = false;
$mailErr = null;

try {
  $mail = new PHPMailer(true);
  $mail->CharSet = 'UTF-8';

  $mail->isSMTP();
  $mail->Host = SMTP_HOST;
  $mail->SMTPAuth = true;
  $mail->Username = SMTP_USER;
  $mail->Password = SMTP_PASS;
  $mail->Port = SMTP_PORT;
  $mail->SMTPSecure = SMTP_SECURE;

  // Si HostGator tiene problemas de SSL, descomenta esto (solo como último recurso):
  // $mail->SMTPOptions = [
  //   'ssl' => [
  //     'verify_peer' => false,
  //     'verify_peer_name' => false,
  //     'allow_self_signed' => true,
  //   ]
  // ];

  $mail->setFrom(MAIL_FROM, MAIL_FROM_NAME);
  $mail->addAddress(MAIL_TO);

  // Reply-To al cliente
  $mail->addReplyTo($email, $nombre);

  $mail->Subject = "New contact - {$nombre}";
  $mail->Body =
    "New contact received:\n\n" .
    "Name: {$nombre}\n" .
    "Email: {$email}\n" .
    "Phone: " . ($telefono ?: '-') . "\n" .
    "Company: " . ($empresa ?: '-') . "\n\n" .
    "Message:\n{$mensaje}\n\n" .
    "Origin: " . ($origen ?: '-') . "\n" .
    "IP: " . ($ip ?: '-') . "\n";

  $mail->send();
  $mailOk = true;

} catch (Throwable $e) {
  // Ojo: NO tumbamos el endpoint, porque ya guardó en DB.
  $mailErr = $e->getMessage();
}

echo json_encode([
  'ok' => true,
  'saved' => true,
  'mail_ok' => $mailOk,
  // Puedes ocultar esto en producción si no quieres filtrar detalles:
  'mail_error' => $mailOk ? null : $mailErr
]);
