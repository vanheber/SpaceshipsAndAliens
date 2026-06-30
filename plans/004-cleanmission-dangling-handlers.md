# Plan 004: Fix dangling DOM handlers after `clearMission()`

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

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: correctness
- **Planned at**: commit `202b7bc`, 2026-06-29

## Why this matters

When `clearMission()` runs, it sets `planet = null` but leaves the discovery slot DOM elements intact with their `onclick` handlers. If a handler fires after `clearMission()`, `setupExpeditionUI()` accesses `planet.name` which throws `TypeError: cannot read properties of null`. This is a latent crash that's hard to reproduce in normal flow but becomes likely if the user clicks rapidly or if state gets out of sync.

Similar issue in `finishExpedition()` — it guards against `discoveries.length === 0` but not `planet === null`, so an edge case dispatch could also crash.

## Current state

`oneshot.html`, `clearMission()` at line 589:
```javascript
function clearMission() {
    localStorage.removeItem(STORAGE_KEY);
    planet = null;
    discoveries = [];
    discoveryIndex = 0;
    lastAIProvider = null;
    document.getElementById("planet-result").style.display = "none";
    document.getElementById("planet-expedition-area").style.display = "none";
    document.getElementById("btn-generate").textContent = "GERAR PLANETA";
    document.getElementById("ai-badge").classList.remove("show");
    showPage("page-planet");
}
```

Note: does NOT clear the expedition area's innerHTML. The discovery slot elements with `onclick` handlers remain in the hidden DOM.

`setupExpeditionUI()` (called by `goToDiscovery`, which is the slot handler) accesses `planet` without null guard:
```javascript
function setupExpeditionUI() {
    document.getElementById("planet-expedition-area").style.display = "block";
    document.getElementById("exp-title").textContent = `Planeta ${planet.name}`;
    // ...
}
```

`finishExpedition()` at line 788:
```javascript
function finishExpedition() {
    if (discoveries.length === 0) return;
    showPage("page-log");
    renderLog();
    saveMission();
}
```
No `planet` guard. `renderLog()` accesses `planet.name`, `planet.type`, `planet.desc`.

Convention note: the rest of the codebase uses early returns for guards (consistent with existing pattern).

## Commands you will need

| Purpose       | Command                  | Expected on success |
|---------------|--------------------------|---------------------|
| Syntax check  | `node -e "new Function(require('fs').readFileSync('oneshot.html','utf8').match(/<script>([\\s\\S]*?)<\\/script>/g).map(s=>s.replace(/<\\/?script>/g,'')).join('\\n'))"` | exit 0 |

## Scope

**In scope**: `oneshot.html` — `clearMission()`, `finishExpedition()`, `setupExpeditionUI()`.

**Out of scope**: Any other files or functions.

## Git workflow

No branches or commits — operator merges directly.

## Steps

### Step 1: Clear expedition area innerHTML in `clearMission()`

Add one line to clear the expedition content container so any remaining DOM elements with handlers are destroyed:

In `clearMission()`, after `document.getElementById("planet-expedition-area").style.display = "none";`, add:
```javascript
document.getElementById("exp-content").innerHTML = "";
```

**Why**: `exp-content` is the container for discovery cards and slot elements. Emptying it removes all child elements and their event handlers, preventing stale handler execution.

### Step 2: Add `planet` guard to `finishExpedition()`

Change:
```javascript
function finishExpedition() {
    if (discoveries.length === 0) return;
```
to:
```javascript
function finishExpedition() {
    if (!planet || discoveries.length === 0) return;
```

### Step 3: Add `planet` guard to `setupExpeditionUI()`

Add at the top of the function:
```javascript
function setupExpeditionUI() {
    if (!planet) return;
    // ... existing code
```

**Verify each step**:
```bash
node -e "new Function(require('fs').readFileSync('oneshot.html','utf8').match(/<script>([\s\S]*?)<\/script>/g).map(s=>s.replace(/<\/?script>/g,'')).join('\n'))" && echo "OK"
```
Expected: `OK` (no syntax errors)

## Test plan

Manual:
1. Generate a planet, start expedition, generate 1-2 discoveries.
2. Click "Limpar Sessão" (or the clear mission action that calls `clearMission()`).
3. In DevTools console, manually trigger `goToDiscovery(0)` — should not crash (returns silently due to `planet` guard in `setupExpeditionUI()`).
4. Start a new planet, generate discoveries, finish expedition — confirm `finishExpedition()` works correctly.

## Done criteria

- [ ] Node syntax check exits 0
- [ ] `clearMission()` now clears `exp-content.innerHTML`
- [ ] `finishExpedition()` has `!planet` guard
- [ ] `setupExpeditionUI()` has `!planet` guard
- [ ] No other functions in `oneshot.html` access `planet` without null guard (check with `grep -n "planet\." oneshot.html` and manually review each)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- The code at the locations above doesn't match the excerpts (function names changed or code restructuring happened).
- A syntax check fails after a fix attempt.
- You discover other functions accessing `planet` without guards that should be included.

## Maintenance notes

- Future additions to `clearMission()` should also clean up dynamically created DOM elements and their handlers.
- The guard pattern (`if (!x) return;`) is the repo's existing convention for null safety — keep it consistent.
