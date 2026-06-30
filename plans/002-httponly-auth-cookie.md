# Plan 002: Set `httponly` true on auth cookie

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 202b7bc..HEAD -- api/auth.php`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: XS
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `202b7bc`, 2026-06-29

## Why this matters

The `warp_auth` cookie is set with `httponly => false`, meaning JavaScript running in the browser can read `document.cookie` and extract the auth token. If any XSS vulnerability exists anywhere on the domain, the token is stealable. The cookie is only read server-side by `proxy.php` for authentication — there is zero client-side code that reads `warp_auth`. Setting `httponly => true` prevents any script access with no functional cost.

## Current state

`api/auth.php`, line 115:
```php
setcookie('warp_auth', $cookieValue, [
    'expires' => time() + 86400 * 30,
    'path' => '/',
    'domain' => '',
    'secure' => true,
    'httponly' => false,
    'samesite' => 'Lax'
]);
```

The cookie is set on successful password + TOTP verification. It's read by `api/proxy.php` line 27: `$cookie = $_COOKIE['warp_auth'] ?? '';`

No client-side JS reads this cookie — confirming with:
```bash
grep -rn 'warp_auth' --include='*.html'
```
Expected: only PHP references (check endpoint, cookie name in fetch URL).

## Commands you will need

| Purpose       | Command                  | Expected on success |
|---------------|--------------------------|---------------------|
| Syntax check  | `php -l api/auth.php`    | exit 0              |
| JS reference grep | `grep -rn 'warp_auth' *.html` | no JS reads it |

## Scope

**In scope**: `api/auth.php` — one boolean change.

**Out of scope**: Any other files.

## Git workflow

No branches or commits needed — operator merges directly.

## Steps

### Step 1: Change `httponly` to `true`

In `api/auth.php`, line 115, change:
```php
'httponly' => false,
```
to:
```php
'httponly' => true,
```

**Verify**:
```bash
php -l api/auth.php
```
Expected: `No syntax errors detected`

### Step 2: Confirm no client-side JS reads this cookie

```bash
grep -rn 'warp_auth' *.html
```
Expected output: matches in `.html` files should only be URL strings like `api/auth.php` or PHP bootstrap, NOT `document.cookie` or direct cookie reads.

If any `.html` file reads `document.cookie` looking for `warp_auth`, stop and report — that code would break with `httponly`.

## Test plan

Manual:
1. Clear cookies for localhost.
2. Open `oneshot.html`, login with valid credentials.
3. In DevTools → Application → Cookies, confirm `warp_auth` cookie has `HttpOnly` flag checked.
4. In DevTools → Console, run `document.cookie` — confirm `warp_auth` is NOT visible.
5. Trigger a Gemini proxy call (generate planet with auth) — confirm it still works (proxy reads the cookie server-side via `$_COOKIE` which is unaffected by `httponly`).

## Done criteria

- [ ] `php -l api/auth.php` exits 0
- [ ] `grep "httponly.*false" api/auth.php` returns no matches
- [ ] `grep "httponly.*true" api/auth.php` returns exactly 1 match
- [ ] No client-side JS reads the cookie (confirmed via grep above)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- The auth.php excerpt doesn't match (cookie array structure changed).
- Any client-side JS reads `warp_auth` and would break with `httponly`.

## Maintenance notes

- If future code needs to read the auth token client-side (e.g., for AJAX headers), the server should set a separate non-httponly cookie with just a session indicator, not the full auth token.
