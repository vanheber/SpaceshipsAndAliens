<?php
require_once __DIR__ . '/load-env.php';
loadEnv();
require_once __DIR__ . '/rate-limit.php';
checkRateLimit();

$allowedOrigins = ['http://localhost:3000', 'http://localhost:8000', 'http://localhost:8080', 'http://localhost', 'http://warp-unit.test', 'http://projetos-git.test', 'null'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$corsOrigin = in_array($origin, $allowedOrigins, true) ? $origin : 'null';
header('Access-Control-Allow-Origin: ' . $corsOrigin);
header('Access-Control-Allow-Methods: POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Max-Age: 86400');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$hmacKey = getenv('TOTP_SECRET') ?: getenv('AUTH_PASSWORD') ?: getenv('GEMINI_KEY');

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $cookie = $_COOKIE['warp_auth'] ?? '';
    if (!$cookie || !$hmacKey) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'message' => 'Não autenticado']);
        exit;
    }
    $parts = explode('.', $cookie);
    if (count($parts) !== 2 || !hash_equals(hash_hmac('sha256', $parts[0], $hmacKey), $parts[1])) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'message' => 'Sessão inválida']);
        exit;
    }
    echo json_encode(['ok' => true, 'message' => 'Autenticado']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    setcookie('warp_auth', '', [
        'expires' => 1,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    echo json_encode(['ok' => true, 'message' => 'Sessão encerrada']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$password = $input['password'] ?? $_POST['password'] ?? '';

if (!$password) {
    http_response_code(400);
    echo json_encode(['error' => 'Senha não fornecida']);
    exit;
}

$valid = false;

$authPass = getenv('AUTH_PASSWORD');
if ($authPass && (strpos($authPass, '$2y$') === 0 || strpos($authPass, '$2a$') === 0)) {
    $valid = password_verify($password, $authPass);
} elseif ($hmacKey) {
    $valid = hash_equals($hmacKey, $password);
}

if (!$valid) {
    http_response_code(401);
    echo json_encode(['error' => 'Senha inválida']);
    exit;
}

$timestamp = (string) time();
$sig = hash_hmac('sha256', $timestamp, $hmacKey);
$cookieValue = $timestamp . '.' . $sig;

setcookie('warp_auth', $cookieValue, [
    'expires' => time() + 86400 * 30,
    'path' => '/',
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Lax'
]);

echo json_encode(['ok' => true, 'message' => 'Autenticado']);
