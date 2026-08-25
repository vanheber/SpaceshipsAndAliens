<?php
// ponytail: race condition ceiling under high concurrent load due to non-atomic file reads/writes.
// Upgrade path: Use Redis (or APCu/Swoole table) for atomic rate increments.
function checkRateLimit(): void {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    $hash = md5($ip);
    $dir = sys_get_temp_dir() . '/sna_rate_limits';
    if (!is_dir($dir)) {
        @mkdir($dir, 0777, true);
    }
    $file = $dir . '/' . $hash . '.json';
    $now = time();
    $limit = 60; // 60 requests per minute
    $window = 60;

    $data = ['timestamp' => $now, 'count' => 0];
    if (file_exists($file)) {
        $content = @file_get_contents($file);
        if ($content) {
            $parsed = json_decode($content, true);
            if ($parsed && ($now - $parsed['timestamp'] < $window)) {
                $data = $parsed;
            }
        }
    }

    $data['count']++;
    @file_put_contents($file, json_encode($data));

    if ($data['count'] > $limit) {
        http_response_code(429);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Rate limit exceeded. Try again later.']);
        exit;
    }
}
