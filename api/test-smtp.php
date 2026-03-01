<?php
/**
 * Diagnóstico SMTP — ELIMINAR después de usar
 * Visita: mirmibug.com/api/test-smtp.php
 */
error_reporting(E_ALL);
ini_set('display_errors', '1');

require_once __DIR__ . '/config.php';

echo "<h3>Test SMTP - Mirmibug</h3>\n";
echo "Host: " . SMTP_HOST . "<br>\n";
echo "Port: " . SMTP_PORT . "<br>\n";
echo "User: " . SMTP_USER . "<br>\n";
echo "To: " . MAIL_TO . "<br>\n";
echo "<hr>\n";

try {
  require_once __DIR__ . '/mailer/Exception.php';
  require_once __DIR__ . '/mailer/PHPMailer.php';
  require_once __DIR__ . '/mailer/SMTP.php';

  use PHPMailer\PHPMailer\PHPMailer;

  $mail = new PHPMailer(true);
  $mail->CharSet = 'UTF-8';
  $mail->SMTPDebug = 2; // Muestra TODA la conversación SMTP
  $mail->Debugoutput = function($str, $level) { echo "<pre>$str</pre>"; };

  $mail->isSMTP();
  $mail->Host = SMTP_HOST;
  $mail->SMTPAuth = true;
  $mail->AuthType = 'LOGIN';
  $mail->Username = SMTP_USER;
  $mail->Password = SMTP_PASS;
  $mail->Port = (int) SMTP_PORT;
  $mail->Timeout = 10;
  $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;

  $mail->setFrom(SMTP_USER, 'Mirmibug Web TEST');
  $mail->addAddress(MAIL_TO, 'Contacto Mirmibug');

  $mail->Subject = "TEST SMTP - " . date('Y-m-d H:i:s');
  $mail->Body = "Este es un correo de prueba desde test-smtp.php\nFecha: " . date('Y-m-d H:i:s');

  $mail->send();
  echo "<br><b style='color:green'>CORREO ENVIADO EXITOSAMENTE</b>\n";

} catch (Throwable $e) {
  echo "<br><b style='color:red'>ERROR: " . $e->getMessage() . "</b>\n";
}
