# Plan 005: Add diagnostic logging to empty catch blocks in AI cascade

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 202b7bc..HEAD -- oneshot.html`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: XS
- **Risk**: LOW
- **Depends on**: none (but applies to same file as Plan 004; coordinate if both execute)
- **Category**: dx
- **Planned at**: commit `202b7bc`, 2026-06-29

## Why this matters

The AI cascade tries up to 5 providers (Gemini → NVIDIA → Pollinations → Hermes → Local). When all 5 fail, the game falls back to local data. This is correct behavior. But the empty `catch (e) {}` blocks provide zero diagnostic information about WHICH provider failed, with WHAT error, and at WHICH step. If a provider starts failing silently (expired key, API change, network issue), there's no way to detect it without manually checking DevTools network tab or adding console instrumentation after the fact. A simple `console.warn` per catch gives operators visibility into cascade health without changing user-visible behavior.

## Current state

Three empty catch blocks in `oneshot.html`:

Line 308 (inside `tryAIProviders`, individual provider attempt):
```javascript
try {
    const response = await fetch(url, { ... });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    result = data;
    providerName = PROVIDER_LABELS[provider];
} catch (e) {}
```

Line 618 (inside `generatePlanet`):
```javascript
} catch (e) {}
```
This catches failures from `tryAIProviders` when generating a planet.

Line 715 (inside `nextDiscovery`, AI generation fallback):
```javascript
} catch (e) {}
```
This catches failures from `aiGenerateDiscovery`.

The project has no structured logging. `console.warn` is the appropriate level — not `console.error` (not a user-facing error since fallback works) and not `console.log` (too noisy). The convention is: `console.warn("[provider] message")`.

## Commands you will need

| Purpose       | Command                  | Expected on success |
|---------------|--------------------------|---------------------|
| Syntax check  | `node -e "new Function(require('fs').readFileSync('oneshot.html','utf8').match(/<script>([\\s\\S]*?)<\\/script>/g).map(s=>s.replace(/<\\/?script>/g,'')).join('\\n'))"` | exit 0 |

## Scope

**In scope**: `oneshot.html` — three catch blocks (lines 308, 618, 715).

**Out of scope**:
- Any other files
- Any behavior changes (all catches remain silent to users; only DevTools console gets messages)
- Adding error reporting UI or toast notifications

## Git workflow

No branches or commits — operator merges directly.

## Steps

### Step 1: Add logging to the provider loop catch (line ~308)

In the `tryAIProviders` function, change:
```javascript
} catch (e) {}
```
to:
```javascript
} catch (e) {
    console.warn(`[${provider}] ${e?.message || e}`);
}
```

This block iterates through providers; if a single provider fails, the loop continues to the next. The warning identifies which provider and what error occurred.

### Step 2: Add logging to `generatePlanet` catch (line ~618)

Change:
```javascript
} catch (e) {}
```
to:
```javascript
} catch (e) {
    console.warn('[generatePlanet]', e?.message || e);
}
```

### Step 3: Add logging to `nextDiscovery` catch (line ~715)

Change:
```javascript
} catch (e) {}
```
to:
```javascript
} catch (e) {
    console.warn('[nextDiscovery]', e?.message || e);
}
```

**Verify**:
```bash
node -e "new Function(require('fs').readFileSync('oneshot.html','utf8').match(/<script>([\s\S]*?)<\/script>/g).map(s=>s.replace(/<\/?script>/g,'')).join('\n'))" && echo "OK"
```
Expected: `OK`

## Test plan

Manual:
1. Open DevTools Console tab.
2. Trigger a planet generation that falls through all AI providers (e.g., disconnect network before clicking "GERAR PLANETA").
3. Confirm `console.warn` messages appear showing each provider attempt and the error.
4. Confirm the local fallback still works (planet/discovery generated from local data despite AI failures).

## Done criteria

- [ ] Node syntax check exits 0
- [ ] `grep -c "catch (e) {}" oneshot.html` returns 0 (no empty catches remain)
- [ ] `grep -c "console.warn" oneshot.html` returns ≥3 (one per formerly empty catch)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- Any catch block structure differs from the excerpts above (e.g., renamed variables, different nesting).
- A syntax check fails after a fix attempt.
- You find additional empty catch blocks beyond the 3 listed.

## Maintenance notes

- If a structured logging approach is added later (e.g., Sentry, OpenTelemetry), these `console.warn` calls are easy grep targets to upgrade.
- The `[provider]` and `[functionName]` prefixes make it easy to filter DevTools console output.
