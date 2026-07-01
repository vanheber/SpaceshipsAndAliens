<?php
require_once __DIR__ . '/load-env.php';
loadEnv();

$allowedOrigins = ['http://localhost:3000', 'http://localhost:8000', 'http://localhost:8080', 'http://localhost', 'http://warp-unit.test', 'null'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$corsOrigin = in_array($origin, $allowedOrigins, true) ? $origin : 'null';
header('Access-Control-Allow-Origin: ' . $corsOrigin);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Max-Age: 86400');
header('Cache-Control: no-store, must-revalidate');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$cookie = $_COOKIE['warp_auth'] ?? '';
$hmacKey = getenv('TOTP_SECRET') ?: getenv('AUTH_PASSWORD') ?: getenv('GEMINI_KEY');
if (!$cookie || !$hmacKey) {
    http_response_code(401);
    echo json_encode(['error' => 'Authentication required']);
    exit;
}
$parts = explode('.', $cookie);
if (count($parts) !== 2 || !hash_equals(hash_hmac('sha256', $parts[0], $hmacKey), $parts[1])) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid session']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || empty($input['messages'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid request']);
    exit;
}

$model = $input['model'] ?? 'gemini-3.1-flash-lite-preview';
$messages = $input['messages'];
$temperature = $input['temperature'] ?? 0.95;

$systemInstruction = null;
$contents = [];

foreach ($messages as $msg) {
    if ($msg['role'] === 'system') {
        $systemInstruction = ['parts' => [['text' => $msg['content']]]];
    } else {
        $contents[] = [
            'parts' => [['text' => $msg['content']]],
            'role' => 'user'
        ];
    }
}
if (empty($contents)) {
    http_response_code(400);
    echo json_encode(['error' => 'No user message found']);
    exit;
}

$geminiKey = getenv('GEMINI_KEY');
if (!$geminiKey) {
    http_response_code(500);
    echo json_encode(['error' => 'Server misconfigured: GEMINI_KEY not set']);
    exit;
}

$url = 'https://generativelanguage.googleapis.com/v1beta/models/' . urlencode($model) . ':generateContent?key=' . urlencode($geminiKey);

$body = [];
if ($systemInstruction) {
    $body['system_instruction'] = $systemInstruction;
}
$body['contents'] = $contents;
$body['generationConfig'] = ['temperature' => floatval($temperature)];

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode($body),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_CONNECTTIMEOUT => 5
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);

if ($curlError) {
    http_response_code(502);
    echo json_encode(['error' => 'Upstream connection failed']);
    exit;
}

if ($httpCode !== 200) {
    $err = json_decode($response, true);
    http_response_code($httpCode >= 400 ? $httpCode : 500);
    echo json_encode(['error' => $err['error']['message'] ?? 'Upstream error']);
    exit;
}

$data = json_decode($response, true);
$candidates = $data['candidates'] ?? [];
$first = $candidates[0] ?? null;
$text = $first['content']['parts'][0]['text'] ?? '';
$finishReason = strtolower($first['finishReason'] ?? 'STOP');
$usage = $data['usageMetadata'] ?? null;

$openaiResponse = [
    'id' => 'gemini-' . bin2hex(random_bytes(8)),
    'object' => 'chat.completion',
    'created' => time(),
    'model' => $model,
    'choices' => [[
        'index' => 0,
        'message' => [
            'role' => 'assistant',
            'content' => $text
        ],
        'finish_reason' => $finishReason === 'stop' ? 'stop' : 'length'
    ]],
    'usage' => $usage ? [
        'prompt_tokens' => $usage['promptTokenCount'] ?? 0,
        'completion_tokens' => $usage['candidatesTokenCount'] ?? 0,
        'total_tokens' => ($usage['totalTokenCount'] ?? 0)
    ] : null
];

header('Content-Type: application/json');
echo json_encode($openaiResponse);
