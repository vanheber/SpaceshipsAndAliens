<?php
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        putenv($line);
    }
}

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Max-Age: 86400');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function base32_decode($input) {
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $input = strtoupper(rtrim($input, '='));
    $output = '';
    $buffer = 0;
    $bits = 0;
    for ($i = 0; $i < strlen($input); $i++) {
        $pos = strpos($alphabet, $input[$i]);
        if ($pos === false) continue;
        $buffer = ($buffer << 5) | $pos;
        $bits += 5;
        if ($bits >= 8) {
            $bits -= 8;
            $output .= chr(($buffer >> $bits) & 0xFF);
        }
    }
    return $output;
}

function verify_totp($secret, $code, $period = 30, $digits = 6) {
    $key = base32_decode($secret);
    $timeSlice = floor(time() / $period);
    for ($i = -1; $i <= 1; $i++) {
        $ts = pack('J', $timeSlice + $i);
        $hash = hash_hmac('sha1', $ts, $key, true);
        $offset = ord($hash[strlen($hash) - 1]) & 0x0F;
        $binary = (ord($hash[$offset]) & 0x7F) << 24 |
                  (ord($hash[$offset + 1]) & 0xFF) << 16 |
                  (ord($hash[$offset + 2]) & 0xFF) << 8 |
                  (ord($hash[$offset + 3]) & 0xFF);
        $otp = str_pad($binary % pow(10, $digits), $digits, '0', STR_PAD_LEFT);
        if (hash_equals($otp, $code)) return true;
    }
    return false;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $check = $_GET['check'] ?? '';
    if ($check === '1') {
        $cookie = $_COOKIE['warp_auth'] ?? '';
        $parts = explode('.', $cookie);
        $AUTH_PASSWORD = getenv('AUTH_PASSWORD');
        $TOTP_SECRET = getenv('TOTP_SECRET');
        $hmacKey = $TOTP_SECRET ?: $AUTH_PASSWORD;
        $valid = count($parts) === 2 && $hmacKey && hash_equals(hash_hmac('sha256', $parts[0], $hmacKey), $parts[1]);
        header('Content-Type: application/json');
        echo json_encode(['authenticated' => $valid]);
        exit;
    }
    http_response_code(400);
    echo json_encode(['error' => 'Use ?check=1 to verify auth']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid request']);
    exit;
}

$password = $input['password'] ?? '';
$totp = $input['totp'] ?? '';

$AUTH_PASSWORD = getenv('AUTH_PASSWORD');
$TOTP_SECRET = getenv('TOTP_SECRET');

if (!$password || !password_verify($password, $AUTH_PASSWORD)) {
    http_response_code(401);
    echo json_encode(['error' => 'Senha invalida']);
    exit;
}

if ($TOTP_SECRET && !verify_totp($TOTP_SECRET, $totp)) {
    http_response_code(401);
    echo json_encode(['error' => 'Codigo TOTP invalido']);
    exit;
}

$token = bin2hex(random_bytes(32));
$signature = hash_hmac('sha256', $token, $TOTP_SECRET ?: $AUTH_PASSWORD);
$cookieValue = $token . '.' . $signature;
setcookie('warp_auth', $cookieValue, [
    'expires' => time() + 86400 * 30,
    'path' => '/',
    'domain' => '',
    'secure' => true,
    'httponly' => false,
    'samesite' => 'Lax'
]);

header('Content-Type: application/json');
echo json_encode(['success' => true]);
