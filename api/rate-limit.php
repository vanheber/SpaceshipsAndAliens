<?php
/**
 * Simple file-based rate limiter.
 * ponytail: file locking is racy under concurrent PHP processes (lock
 * granularity is per-file). Acceptable for single-user tool. Upgrade to
 * Redis atomic counters if multiple concurrent users hit auth.
 */
function checkRateLimit(string $ip, int $maxAttempts = 5, int $window = 300): bool {
    $dir = sys_get_temp_dir() . '/warp-rate-limit';
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    $file = $dir . '/' . md5($ip);
    $now = time();
    $attempts = [];

    if (file_exists($file)) {
        $attempts = json_decode(file_get_contents($file), true) ?? [];
        $attempts = array_filter($attempts, fn($t) => $t > $now - $window);
    }

    if (count($attempts) >= $maxAttempts) {
        return false; // rate limited
    }

    $attempts[] = $now;
    file_put_contents($file, json_encode(array_values($attempts)), LOCK_EX);
    return true;
}
