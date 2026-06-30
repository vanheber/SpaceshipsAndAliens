# Plan 003: Extract shared `.env` loader from 3 PHP files

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

- **Priority**: P2
- **Effort**: XS
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `202b7bc`, 2026-06-29

## Why this matters

The same 9-line `.env` file parser appears verbatim at the top of `api/auth.php`, `api/proxy.php`, and `api/proxy-nvidia.php`. This is a classic copy-paste pattern: when the loader needs to change (e.g., add support for additional env file formats, change parsing behavior, add error handling), three files must be updated in lockstep. Already the copies have started to drift — `proxy.php` and `proxy-nvidia.php` set a `Cache-Control` header that `auth.php` doesn't (trivial evidence of copy divergence). Extracting to a single include reduces maintenance surface and ensures consistent env loading behavior.

## Current state

Every PHP file begins with identical code:

`api/auth.php` lines 1-9, `api/proxy.php` lines 1-9, `api/proxy-nvidia.php` lines 1-9:
```php
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        putenv($line);
    }
}
```

The `.htaccess` file also provides Apache-level protection (blocks direct `.env` access via `<Files .env>`), but the PHP-side loader is the actual mechanism that makes env vars available to PHP.

The three files also share identical CORS + OPTIONS preflight handling, but that's Plan 001's scope. This plan is focused on the env loader.

## Commands you will need

| Purpose       | Command                          | Expected on success |
|---------------|----------------------------------|---------------------|
| Syntax check  | `php -l api/load-env.php` (new) | exit 0              |
| Syntax check  | `php -l api/auth.php`            | exit 0              |
| Syntax check  | `php -l api/proxy.php`           | exit 0              |
| Syntax check  | `php -l api/proxy-nvidia.php`    | exit 0              |

## Scope

**In scope**:
- `api/load-env.php` (create)
- `api/auth.php` (add `require_once`, remove inline loader)
- `api/proxy.php` (add `require_once`, remove inline loader)
- `api/proxy-nvidia.php` (add `require_once`, remove inline loader)

**Out of scope**:
- Any CORS header changes (Plan 001)
- Any cookie changes (Plan 002)
- Any HTML/JS/CSS files

## Git workflow

No branches or commits — operator merges directly.

## Steps

### Step 1: Create `api/load-env.php`

Create a new file `api/load-env.php` with the extracted logic wrapped in a function call. The function uses `require_once` semantics (it should define a function, and each caller calls it):

```php
<?php
function loadEnv(): void {
    $envFile = __DIR__ . '/../.env';
    if (!file_exists($envFile)) return;
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        putenv($line);
    }
}
```

No trailing `?>` tag per PHP convention (prevents accidental whitespace output).

**Verify**:
```bash
php -l api/load-env.php
```
Expected: `No syntax errors detected`

### Step 2: Update `api/auth.php`

Replace lines 1-9 (the inline env loader) with:
```php
<?php
require_once __DIR__ . '/load-env.php';
loadEnv();
```

Keep the `<?php` opening tag.

**Verify**:
```bash
php -l api/auth.php
```
Expected: `No syntax errors detected`

### Step 3: Update `api/proxy.php`

Same change: replace lines 1-9 with:
```php
<?php
require_once __DIR__ . '/load-env.php';
loadEnv();
```

Keep the rest of the file as-is.

**Verify**:
```bash
php -l api/proxy.php
```
Expected: `No syntax errors detected`

### Step 4: Update `api/proxy-nvidia.php`

Same change: replace lines 1-9 with:
```php
<?php
require_once __DIR__ . '/load-env.php';
loadEnv();
```

**Verify**:
```bash
php -l api/proxy-nvidia.php
```
Expected: `No syntax errors detected`

### Step 5: Confirm no remaining inline loaders

```bash
grep -rn 'putenv' api/
```
Expected: exactly 1 match, in `api/load-env.php`:
```
api/load-env.php:        putenv($line);
```

## Test plan

Manual:
1. Visit each page that uses a PHP proxy (`index.html` for dice? no — dice are client-side. `oneshot.html` for Gemini/NVIDIA).
2. Trigger a Gemini call (with auth) — should succeed.
3. Trigger a NVIDIA call (without auth) — should succeed.
4. If auth flow still works (login → cookie set → proxy validated), env vars are loading correctly.

## Done criteria

- [ ] `php -l api/load-env.php` exits 0
- [ ] `php -l api/auth.php api/proxy.php api/proxy-nvidia.php` all exit 0
- [ ] `grep -rn 'putenv' api/` returns exactly 1 match (in `load-env.php`)
- [ ] `grep -rn 'file($envFile' api/` returns 0 matches (no inline loaders remain)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- Any PHP file has a different env loading pattern than the excerpt above.
- The auto-prepend mechanism is configured elsewhere (we'd be duplicating).
- A syntax check fails after a reasonable fix attempt.

## Maintenance notes

- Future PHP endpoints should use `require_once __DIR__ . '/load-env.php'; loadEnv();` to get env vars.
- If a new `.env` format is needed (e.g., `export` prefix), only `load-env.php` changes.
