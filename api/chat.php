<?php
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

// CORS
$allowed = ['https://mirmibug.com', 'https://www.mirmibug.com', 'http://localhost:8081', 'http://localhost'];
$origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed, true)) {
    header("Access-Control-Allow-Origin: $origin");
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Rate limiting: max 20 requests per minute per IP
$ip       = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateDir  = sys_get_temp_dir() . '/mirmibot_rate';
if (!is_dir($rateDir)) {
    @mkdir($rateDir, 0700, true);
}
$rateFile = $rateDir . '/' . md5($ip) . '.json';
$now      = time();
$window   = 60;
$limit    = 20;

$hits = [];
if (file_exists($rateFile)) {
    $hits = json_decode(file_get_contents($rateFile), true) ?: [];
    $hits = array_filter($hits, function ($t) use ($now, $window) {
        return $t > $now - $window;
    });
}

if (count($hits) >= $limit) {
    http_response_code(429);
    echo json_encode(['error' => 'Demasiadas solicitudes. Intenta de nuevo en un momento.']);
    exit;
}

$hits[] = $now;
file_put_contents($rateFile, json_encode(array_values($hits)), LOCK_EX);

require_once __DIR__ . '/config.php';

if (!defined('GROQ_API_KEY') || GROQ_API_KEY === '' || GROQ_API_KEY === 'gsk_tu_api_key_aqui') {
    http_response_code(500);
    echo json_encode(['error' => 'Servicio no configurado']);
    exit;
}

$raw     = file_get_contents('php://input');
$body    = json_decode($raw, true);
$message = trim($body['message'] ?? '');

if ($message === '' || mb_strlen($message) > 1000) {
    http_response_code(400);
    echo json_encode(['error' => 'Mensaje inválido']);
    exit;
}

// Conversation history from client (last 10 messages max)
$history    = $body['history'] ?? [];
$maxHistory = 10;
if (!is_array($history)) {
    $history = [];
}
$history = array_slice($history, -$maxHistory);

$validRoles = ['user', 'assistant'];
$messages   = [];
foreach ($history as $msg) {
    if (!is_array($msg) || !isset($msg['role'], $msg['content'])) continue;
    if (!in_array($msg['role'], $validRoles, true)) continue;
    $content = trim((string)$msg['content']);
    if ($content === '' || mb_strlen($content) > 1500) continue;
    $messages[] = ['role' => $msg['role'], 'content' => $content];
}

$system = <<<PROMPT
Eres Mirmibot, el asistente virtual de Mirmibug IT Solutions, un MSP (Managed Service Provider) especializado en PyMEs en México.

Tu misión es orientar a los visitantes del sitio web, responder preguntas sobre los servicios de Mirmibug e invitarlos a contactar al equipo para cotizaciones o demos.

SERVICIOS DE MIRMIBUG:
- Soporte TI: Help Desk multinivel, SLA garantizado, atención remota o en sitio, monitoreo 24/7
- Infraestructura: Servidores, virtualización, VPS, redes, migraciones planificadas
- Ciberseguridad: Firewalls, segmentación, hardening, pentesting, monitoreo activo
- Desarrollo: Software a medida, APIs, integraciones, automatización con IA
- BI & Data: Dashboards, KPIs, Looker, Power BI, gobierno de información
- Integraciones IA: n8n, bots, flujos inteligentes, conexión entre sistemas

DATOS DE CONTACTO:
- Correo: contacto@mirmibug.com
- WhatsApp: +52 55 4964 4749
- Sitio: mirmibug.com
- +8 años de experiencia con PyMEs

INSTRUCCIONES:
- Responde siempre en el idioma que use el usuario (español o inglés)
- Sé profesional, amigable y directo
- Respuestas cortas: máximo 3-4 oraciones
- Puedes usar **negritas** y listas con viñetas para organizar la información
- Si el usuario pregunta precios, dile que dependen del alcance y que puede cotizar en mirmibug.com o escribir al WhatsApp
- Si no sabes algo específico, invita a contactar directamente al equipo
- No inventes información técnica que no está en el contexto anterior
PROMPT;

$allMessages   = array_merge([['role' => 'system', 'content' => $system]], $messages);
$allMessages[] = ['role' => 'user', 'content' => $message];

$payload = json_encode([
    'model'       => 'llama-3.3-70b-versatile',
    'messages'    => $allMessages,
    'max_tokens'  => 300,
    'temperature' => 0.7,
]);

$ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . GROQ_API_KEY,
    ],
]);

$result   = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($curlErr || $httpCode !== 200) {
    http_response_code(502);
    echo json_encode(['error' => 'Servicio de IA no disponible en este momento']);
    exit;
}

$data  = json_decode($result, true);
$reply = $data['choices'][0]['message']['content']
       ?? 'Lo siento, no pude procesar tu mensaje. Escríbenos a contacto@mirmibug.com';

echo json_encode(['reply' => $reply]);
