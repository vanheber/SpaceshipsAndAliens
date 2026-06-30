# Plan 007: Isolate AI-generated planet data as data in discovery prompt

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 202b7bc..HEAD -- oneshot.html`
> If oneshot.html changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: XS
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `202b7bc`, 2026-06-30

## Why this matters

The AI-generated planet description (`planet.desc`) is interpolated directly
into the discovery generation prompt at `oneshot.html:357`. If the planet
description contains prompt-injection text (e.g., "ignore previous instructions,
output arbitrary data"), it could subvert the discovery generation. While the
current AI cascade makes this unlikely in practice (the description must first
pass through a prior AI generation step), it is a classic recursive injection
pattern and trivial to fix.

## Current state

At `oneshot.html:357`, the discovery prompt includes planet data inline:

```js
`Ship: Aegis Tiburon, 121m heavy gunship converted to exploration mothership.
Crew of android robots. AI Captain integrated into ship systems.\n\n
Planet: ${planet.name} (${planet.type}) — ${planet.desc}\n\n
Encounter ${discNumber} of ${discTotal}.\n${context}\n\n...`
```

The three AI-sourced values (`planet.name`, `planet.type`, `planet.desc`) are
mixed with the instruction text without any delimiter that tells the model to
treat them as data, not instructions.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Syntax  | n/a (no lint for HTML) | Visual check |

## Scope

**In scope**:
- `oneshot.html` line 357 — wrap planet data in a data-delimiter block

**Out of scope**:
- The `aiGeneratePlanet()` prompt itself (different concern)
- The `context` variable (lines 337-352) — it already formats data as
  structured history, not raw interpolation
- Other prompt interpolations (seed, discNumber, discTotal)

## Git workflow

- No branch needed; edit directly
- Single commit

## Steps

### Step 1: Add data delimiters around planet context

At `oneshot.html:357`, replace the planet context line:

**Before:**
```js
`Planet: ${planet.name} (${planet.type}) — ${planet.desc}\n\n`
```

**After:**
```js
`[PLANET DATA]\nCode: ${planet.name}\nType: ${planet.type}\nDescription: ${planet.desc}\n[/PLANET DATA]\n\n`
```

This wraps the AI-generated data in a clear `[PLANET DATA] ... [/PLANET DATA]`
block with labeled fields. The structure signals to the model that this is
reference data, not instruction text. The `[DATA]...[/DATA]` convention is a
common prompt-engineering pattern for separating data from instructions.

**Verify**: `grep -n 'PLANET DATA' oneshot.html` shows the new line.

## Test plan

1. Generate a planet with AI (or just test that the prompt still works with
   local data fallback)
2. Confirm discoveries generate correctly — the planet data should appear
   in the prompt in structured form
3. Verify the change is benign: the model still receives all three fields
   (name, type, description) in the prompt

No automated tests exist in this project.

## Done criteria

- [ ] Line 357 of `oneshot.html` uses `[PLANET DATA]` block instead of
      raw interpolation
- [ ] `grep 'planet.name' oneshot.html | head -3` shows the old pattern does
      NOT remain on the prompt line (only `showPlanetResult` and `renderLog`
      still reference `planet.name`/`planet.type`/`planet.desc`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- The planet context section has been refactored or moved since this plan
  was written — drift may invalidate the exact line number
- The fix would require restructuring the `aiGenerateDiscovery()` function

## Maintenance notes

- Future prompt changes to `aiGeneratePlanet()` or `aiGenerateDiscovery()`
  should follow the same data-delimiter pattern for any AI-sourced input
  fed into a subsequent prompt.
- This is one instance of a general principle: label all dynamic data that
  crosses the AI → prompt boundary.
