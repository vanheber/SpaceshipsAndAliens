<?php
require_once __DIR__ . '/rate-limit.php';
checkRateLimit();

$allowedOrigins = ['http://localhost:3000', 'http://localhost:8000', 'http://localhost:8080', 'http://localhost', 'http://warp-unit.test', 'http://projetos-git.test'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (!in_array($origin, $allowedOrigins, true)) {
    http_response_code(403);
    echo json_encode(['error' => 'Origin not allowed']);
    exit;
}
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');
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

$apiKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
if (!$apiKey) {
    http_response_code(400);
    echo json_encode(['error' => 'X-API-Key header required']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || empty($input['messages'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid request']);
    exit;
}

$model = $input['model'] ?? 'deepseek-ai/deepseek-v4-flash';
$messages = $input['messages'];
$temperature = $input['temperature'] ?? 0.95;

$url = 'https://integrate.api.nvidia.com/v1/chat/completions';

$body = [
    'model' => $model,
    'messages' => $messages,
    'temperature' => floatval($temperature),
    'max_tokens' => 512
];

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey
    ],
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
    http_response_code($httpCode >= 400 ? $httpCode : 500);
    echo $response;
    exit;
}

header('Content-Type: application/json');
echo $response;
