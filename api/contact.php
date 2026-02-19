<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
  exit;
}

/* =========================
   CONFIG DB (Pega tus datos)
========================= */
define('DB_HOST', 'localhost');
define('DB_NAME', 'andres63_mirmibug_web');
define('DB_USER', 'andres63_adminmirmibug');
define('DB_PASS', 'ygKtYLN.I1g)');

/* =========================
   CONFIG EMAIL
========================= */
$TO_EMAIL = 'contacto@mirmibug.com';
$FROM_EMAIL = 'contacto@mirmibug.com'; // debe existir como cuenta en tu hosting para mejor deliverability

/* =========================
   HELPERS
========================= */
function clean($s): string { return trim((string)$s); }
function is_email($s): bool { return filter_var($s, FILTER_VALIDATE_EMAIL) !== false; }

function json_out(int $code, array $payload): void {
  http_response_code($code);
  echo json_encode($payload, JSON_UNESCAPED_UNICODE);
  exit;
}

/* =========================
   INPUT (FormData primero)
========================= */
$data = $_POST;

// Si viniera JSON (por si acaso), también lo soportamos:
if (empty($data)) {
  $raw = file_get_contents('php://input');
  $json = json_decode($raw, true);
  if (is_array($json)) $data = $json;
}

$nombre = clean($data['nombre'] ?? '');
$email  = clean($data['email'] ?? '');
$telefono = clean($data['telefono'] ?? '');
$empresa  = clean($data['empresa'] ?? '');
$mensaje  = clean($data['mensaje'] ?? '');
$consentimiento = !empty($data['consentimiento']) ? 1 : 0;
$origen = clean($data['origen'] ?? '');
$honeypot = clean($data['website'] ?? ''); // anti-spam
$quote_summary = clean($data['quote_summary'] ?? ''); // opcional

// Honeypot: bots
if ($honeypot !== '') {
  json_out(200, ['ok' => true]);
}

// Validación mínima
if ($nombre === '' || !is_email($email) || $mensaje === '') {
  json_out(400, ['ok' => false, 'error' => 'Invalid data']);
}

// IP / UA
$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
if (strpos($ip, ',') !== false) $ip = trim(explode(',', $ip)[0]);
$user_agent = $_SERVER['HTTP_USER_AGENT'] ?? '';
$user_agent = $user_agent !== '' ? substr($user_agent, 0, 255) : null;

/* =========================
   DB INSERT
   Tabla esperada: contact_leads
========================= */
try {
  $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
  $pdo = new PDO($dsn, DB_USER, DB_PASS, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
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
  // Para debug real, revisa error_log del hosting
  // error_log("DB error: " . $e->getMessage());
  json_out(500, ['ok' => false, 'error' => 'DB error']);
}

/* =========================
   EMAIL NOTIFY
   (Si falla mail(), igual ya se guardó en DB)
========================= */
$subject = "Nuevo contacto - {$nombre}";

$body = "Nuevo contacto recibido:\n\n" .
  "Nombre: {$nombre}\n" .
  "Email: {$email}\n" .
  "Teléfono: " . ($telefono ?: '-') . "\n" .
  "Empresa: " . ($empresa ?: '-') . "\n\n" .
  "Mensaje:\n{$mensaje}\n\n" .
  "Origen: " . ($origen ?: '-') . "\n" .
  "IP: " . ($ip ?: '-') . "\n";

if ($quote_summary !== '') {
  $body .= "\n\n--- Resumen Cotizador ---\n" . $quote_summary . "\n";
}

$headers = "From: Mirmibug <{$FROM_EMAIL}>\r\n";
$headers .= "Reply-To: {$email}\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

$mail_sent = @mail($TO_EMAIL, $subject, $body, $headers);

json_out(200, ['ok' => true, 'mail_sent' => (bool)$mail_sent]);
