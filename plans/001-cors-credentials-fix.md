# Plan 001: Fix CORS `*` + `Credentials: true` nos 3 PHP proxies

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 202b7bc..HEAD -- api/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `202b7bc`, 2026-06-29

## Why this matters

All three PHP files (`auth.php`, `proxy.php`, `proxy-nvidia.php`) set `Access-Control-Allow-Origin: *` alongside `Access-Control-Allow-Credentials: true`. Per the CORS spec, the combination of a wildcard origin and credentialed requests is invalid — browsers reject the response. `auth.php` and `proxy.php` actually need credentials (they read cookies for auth), so the wildcard must be replaced with the specific requesting origin. `proxy-nvidia.php` does NOT need credentials, so the header should be removed.

## Current state

- `api/auth.php` — lines 11 + 14:
  ```
  header('Access-Control-Allow-Origin: *');
  header('Access-Control-Allow-Credentials: true');
  ```
- `api/proxy.php` — lines 11 + ... (no explicit Credentials header, but `*` is still wrong for credentialed requests)
- `api/proxy-nvidia.php` — line 11: `header('Access-Control-Allow-Origin: *');` No `Credentials` header set.

The repo has no `.env` config for allowed origins. The safest pattern for a PHP proxy: reflect the `Origin` request header when it matches an allowed list, or simply echo it back for credentialed endpoints.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Syntax check | `php -l api/auth.php` | exit 0, `No syntax errors` |
| Syntax check | `php -l api/proxy.php` | exit 0, `No syntax errors` |
| Syntax check | `php -l api/proxy-nvidia.php` | exit 0, `No syntax errors` |

## Scope

**In scope** (the only files you should modify):
- `api/auth.php`
- `api/proxy.php`
- `api/proxy-nvidia.php`

**Out of scope**:
- Any HTML/JS/CSS files
- Changes to `.env` or `.env.example`
- Any other PHP file

## Git workflow

No commits or branches needed — the operator merges directly.

## Steps

### Step 1: Fix `api/proxy-nvidia.php`

This endpoint does NOT use cookies/auth. Remove the `Access-Control-Allow-Credentials` header entirely (it's not set currently, just confirm). Keep `Access-Control-Allow-Origin: *` since this is a public endpoint with no credentials.

Current code (line 11):
```php
header('Access-Control-Allow-Origin: *');
```
No change needed. Verify it has no `Credentials` header:
```bash
grep -n 'Allow-Credentials' api/proxy-nvidia.php
```
Expected: no output (header not present).

### Step 2: Fix `api/auth.php`

Replace the wildcard CORS with origin reflection + explicit allowlist. This is the most sensitive endpoint (handles password and TOTP).

Add BEFORE the existing headers (around line 11):
```php
$allowedOrigins = ['http://localhost:3000', 'http://localhost:8080', 'http://localhost', 'null'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$corsOrigin = in_array($origin, $allowedOrigins, true) ? $origin : 'null';
header('Access-Control-Allow-Origin: ' . $corsOrigin);
header('Access-Control-Allow-Credentials: true');
```

Then REMOVE the old wildcard origin line:
```php
header('Access-Control-Allow-Origin: *');
```

**Verify**:
```bash
php -l api/auth.php
```
Expected: `No syntax errors detected`

### Step 3: Fix `api/proxy.php`

Same pattern as auth.php (it reads cookies for auth). Add the same origin allowlist logic, then remove the wildcard.

After the fix, verify:
```bash
php -l api/proxy.php
```
Expected: `No syntax errors detected`

**Note**: `proxy.php` does NOT currently set `Access-Control-Allow-Credentials: true`. Add it after the origin line, so the browser knows to include cookies in CORS requests.

## Test plan

There are no automated tests. Manual verification:
1. Visit `index.html` locally (served on localhost:8080) and confirm dice rolling works (no CORS errors in console).
2. Visit `oneshot.html` and confirm auth login works → Gemini proxy succeeds.
3. Visit `oneshot.html` without auth and confirm NVIDIA proxy works (public).
4. Check browser devtools → Network tab → response headers show the correct `Access-Control-Allow-Origin` value matching the page's origin, not `*`.

## Done criteria

- [ ] `php -l api/auth.php` exits 0
- [ ] `php -l api/proxy.php` exits 0
- [ ] `php -l api/proxy-nvidia.php` exits 0
- [ ] `grep -n "Access-Control-Allow-Origin: \*" api/auth.php api/proxy.php` returns no matches
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- The code at the locations in "Current state" doesn't match the excerpts (codebase has drifted).
- A syntax check fails twice after a reasonable fix attempt.
- You find an endpoint that needs a different CORS policy (e.g., a future endpoint with a different auth model).

## Maintenance notes

- If the project moves to a production domain, add it to the `$allowedOrigins` array.
- The origin reflection pattern is standard for credentialed CORS endpoints. Keep the allowlist small.
- There are no credentials to rotate here — no secrets in this diff.
