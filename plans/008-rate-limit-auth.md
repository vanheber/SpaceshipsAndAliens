# Plan 008: Add IP-based rate limiting to auth endpoint

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 202b7bc..HEAD -- api/auth.php api/load-env.php`
> If either file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 003 (uses `api/load-env.php` which was created by plan 003)
- **Category**: security
- **Planned at**: commit `202b7bc`, 2026-06-30

## Why this matters

The auth endpoint (`api/auth.php`) accepts unlimited POST requests. An attacker
can brute-force the password or TOTP code with no throttling. While the auth is
already protected by password_hash + TOTP, rate limiting adds a defense layer
against online brute-force attacks. This is a simple file-based rate limiter —
matching the existing PHP style (no external dependencies, no database).

A ponytail `ceiling known` applies: file-based rate limiting is racy under
concurrent requests (two PHP processes can write simultaneously). This is
acceptable for a single-user game tool. The upgrade path is a shared
in-memory store (Redis/Memcached) or a database atomic counter.

## Current state

`api/auth.php` has no rate limiting at lines 79-102:

```php
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) { /* 400 */ }

$password = $input['password'] ?? '';
$totp = $input['totp'] ?? '';

if (!$password || !password_verify($password, $AUTH_PASSWORD)) { /* 401 */ }
if ($TOTP_SECRET && !verify_totp($TOTP_SECRET, $totp)) { /* 401 */ }
```

The function `loadEnv()` and `require_once` pattern is already established in
`api/load-env.php` (created by plan 003).

## Commands you will need

| Purpose   | Command           | Expected on success |
|-----------|-------------------|---------------------|
| Syntax    | `php -l api/auth.php`  | No syntax errors    |
| Syntax    | `php -l api/load-env.php` | No syntax errors |

## Scope

**In scope**:
- `api/rate-limit.php` (new file) — rate limiter implementation
- `api/auth.php` — add rate limit check before auth validation

**Out of scope**:
- `api/proxy.php`, `api/proxy-nvidia.php` — they're already behind the auth
  check, so they're implicitly rate-limited by auth. No change needed.
- Limiting the GET `?check=1` endpoint — it only reads a cookie, cheap operation
- Adding a dependency (Redis, database, etc.) — file-based only
- Changing the password hashing, TOTP verification, or cookie logic

## Git workflow

- No branch needed; edit directly
- Single commit

## Steps

### Step 1: Create `api/rate-limit.php`

Create a new file at `api/rate-limit.php`:

```php
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
```

Follow the existing PHP conventions in the project:
- Opening `<?php` tag only (no closing `?>`)
- 4-space indentation
- Functions at the top, logic below
- `ponytail:` comment naming the ceiling (race condition via concurrent file writes)

**Verify**: `php -l api/rate-limit.php` → "No syntax errors detected"

### Step 2: Apply rate check in `api/auth.php`

Add the require and rate check right after CORS headers and before the OPTIONS
handler. This way, OPTIONS preflight requests are NOT rate-limited (they don't
carry auth data):

```php
// After CORS headers (line 12), before OPTIONS check (line 14):
require_once __DIR__ . '/rate-limit.php';

$ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
if (!checkRateLimit($ip)) {
    http_response_code(429);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Muitas tentativas. Aguarde alguns minutos.']);
    exit;
}
```

The message is in Portuguese ("Too many attempts. Wait a few minutes.") matching
the existing error messages in `api/auth.php:94,100` ("Senha invalida",
"Codigo TOTP invalido").

If `api/rate-limit.php` doesn't exist (plan 003 may not have run yet), the
`require_once` will fatal-error. The dependency on plan 003 is real — the
`require_once` pattern is established there, and this plan assumes it exists.

After the change, `api/auth.php` should look like (new lines marked `+`):

```php
<?php
require_once __DIR__ . '/load-env.php';
loadEnv();
+require_once __DIR__ . '/rate-limit.php';
+
+$ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
+if (!checkRateLimit($ip)) {
+    http_response_code(429);
+    echo json_encode(['error' => 'Muitas tentativas. Aguarde alguns minutos.']);
+    exit;
+}

$allowedOrigins = [...];
...
```

**Verify**: `php -l api/auth.php` → "No syntax errors detected"

## Test plan

Manual verification:
1. Send 5+ failed POST requests to `/api/auth.php` with wrong password
2. The 6th request should return HTTP 429 with the error message
3. Wait 5 minutes (or lower `$window` temporarily) and confirm it resets
4. OPTIONS (preflight) requests should NOT be rate-limited

No automated tests exist in this project.

## Done criteria

- [ ] `api/rate-limit.php` exists with `checkRateLimit()` function
- [ ] `php -l api/rate-limit.php` exits 0
- [ ] `php -l api/auth.php` exits 0
- [ ] `grep 'rate-limit' api/auth.php` shows the `require_once` and `checkRateLimit` call
- [ ] The rate limit does NOT apply to OPTIONS requests (preflight)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- `api/rate-limit.php` already exists (check first: `ls api/rate-limit.php`)
- The auth.php structure has changed significantly (e.g., moved to a class)
- `sys_get_temp_dir()` is not writable in the target environment — this is
  unlikely on any standard PHP setup, but flag it

## Maintenance notes

- The rate limit file directory is `/tmp/warp-rate-limit/`. It survives PHP
  process restarts but is cleared on system reboot — acceptable for this use.
- Defaults: 5 attempts per 5 minutes per IP. Tune `$maxAttempts` and `$window`
  if users report false positives.
- The `LOCK_EX` flag on `file_put_contents` provides advisory locking but is
  not atomic under concurrent PHP-FPM workers. For a single-user tool this is
  fine — the race window is small and the worst case is ~1 extra request gets
  through.
- Future: if this becomes multi-user, migrate to Redis atomic counters.
