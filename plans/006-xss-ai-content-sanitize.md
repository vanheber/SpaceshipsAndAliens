# Plan 006: Sanitize AI-generated content before innerHTML injection

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

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `202b7bc`, 2026-06-30

## Why this matters

AI-generated content (planet name, type, description, discovery details) is
injected directly into `innerHTML` in three render functions. Any AI provider —
especially the public/unauthenticated ones (Pollinations.ai, Hermes) — could
return content with embedded `<script>` tags or event handlers, which would
execute in the user's session context. This is a stored XSS vector with HIGH
impact.

The fix is minimal: escape HTML entities before interpolation. Since the HTML
structure is created by trusted template literals (only the data values are
untrusted), a single sanitization helper applied to every AI-sourced value
solves the problem.

## Current state

Three render functions inject AI-generated data via innerHTML:

1. `showPlanetResult()` at `oneshot.html:555`:
```js
div.innerHTML = `
    <div class="mt-20">
        <div class="planet-name">${planet.name}</div>
        <span class="planet-type">${planet.type}</span>
        <div class="planet-desc">${planet.desc}</div>
    </div>...`;
```

2. `renderCurrentDiscovery()` at `oneshot.html:749`:
```js
container.innerHTML = `...${disc.approach.opener}...${disc.description}...
    ${disc.location}...${disc.peril.text}...${disc.reward.text}...`;
```

3. `renderLog()` at `oneshot.html:808`:
```js
list.innerHTML = discoveries.map((d, i) => `...${d.description}...
    ${d.location}...${d.peril.text}...${d.reward.text}...`).join("");
```

Additionally, `exportMissionMD()` at `oneshot.html:845` writes AI content into
a Markdown blob download — this is safe (Blob download, not HTML execution).

## Commands you will need

| Purpose   | Command     | Expected on success |
|-----------|-------------|---------------------|
| Syntax    | n/a (no lint/build for HTML) | Visual check |

There is no build/lint tooling in this project. Verification is by visual
inspection and grep.

## Scope

**In scope**:
- `oneshot.html` — add a sanitization helper and apply it to all AI-sourced
  innerHTML interpolations

**Out of scope**:
- `index.html`, `missioncontrol.html` — no AI content rendering there
- Changing the HTML structure or CSS classes
- Adding a full DOMPurify dependency — ponytail rule #5 (no new deps)

## Git workflow

- No branch needed; edit directly
- Single commit recommended (one logical fix)

## Steps

### Step 1: Add a sanitization helper

Add this function near the other utility functions (e.g., right after `pick()`
at line 470 in `oneshot.html`):

```js
function esc(s) { return String(s).replace(/[&<>"']/g, function(m) {
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m];
}); }
```

This escapes the five HTML-special characters. It is intentionally a single
expression — matching the ponytail `Dá pra ser uma linha? Faz uma linha.` rule.
The convention for small helpers in this file is compact one-liners (see `pick`,
`d`, `d4`, `d6`, `d8` at lines 470-474).

**Verify**: Read the added lines and confirm `esc('<script>alert(1)</script>')`
would produce `&lt;script&gt;alert(1)&lt;/script&gt;`.

### Step 2: Apply `esc()` to `showPlanetResult()`

At `oneshot.html:557-559`, wrap all AI-generated values:

```js
<div class="planet-name">${esc(planet.name)}</div>
<span class="planet-type">${esc(planet.type)}</span>
<div class="planet-desc">${esc(planet.desc)}</div>
```

The existing structure (`planet-result` innerHTML) already only uses these
three AI-sourced interpolations — the rest is static HTML and `planet.discTotal`
(a trusted number).

**Verify**: `grep -n 'esc(planet' oneshot.html` shows 3 occurrences.

### Step 3: Apply `esc()` to `renderCurrentDiscovery()`

At `oneshot.html:749-771`, wrap every AI-generated value. The relevant fields
that come from the AI (directly or through `disc`):
- `disc.approach.label` (line 752)
- `disc.approach.opener` (line 757)
- `disc.description` (line 758)
- `disc.location` (line 760)
- `disc.peril.text` (line 763)
- `disc.reward.text` (line 767)
- `disc.reward.type` (line 766 — value is from REWARD_LABELS lookup, but the
  key `disc.reward.type` is AI-generated, so wrap it too)

`disc.peril.dc` is a number — no wrapping needed.
`disc.approach.class` and `etClass` are trusted CSS classes — no wrapping needed.
`etLabel` is derived from `disc.encounterType` via a lookup — no wrapping needed.

Wrap each value:
```js
${esc(disc.approach.label)}
${esc(disc.approach.opener)}<br><br>
${esc(disc.description)}
${esc(disc.location)}
${esc(disc.peril.text)}
${esc(disc.reward.text)}
${esc(REWARD_LABELS[disc.reward.type] || "RECURSO")}
```

Note: `REWARD_LABELS` is a trusted data object, but `disc.reward.type` is
AI-generated and used as its key. The `|| "RECURSO"` fallback already handles
invalid keys, and `REWARD_LABELS[anyInvalidKey]` would return `undefined`,
which `esc()` would turn into `""` — this is safe. However, to be explicit:

```js
${esc(REWARD_LABELS[disc.reward.type] || "RECURSO")}
```

**Verify**: `grep -n 'esc(disc' oneshot.html` shows 7 occurrences.

### Step 4: Apply `esc()` to `renderLog()`

At `oneshot.html:808-820`, wrap the same AI-sourced values. The interpolations
are on lines 814-818:
- `d.approach.label` (line 814)
- `d.description` (line 815)
- `d.location` (line 816)
- `d.peril.text` (line 817)
- `d.reward.text` (line 818)

`d.approach.logClass` is a trusted CSS class — no wrapping.
`planet.discTotal` is a trusted number — no wrapping.

Wrap:
```js
<div class="log-approach ${d.approach.logClass}">${esc(d.approach.label)}</div>
<div class="log-desc">${esc(d.description)}</div>
<div class="log-loc">📍 ${esc(d.location)}</div>
<div class="log-peril">⚡ DC ${d.peril.dc} &mdash; ${esc(d.peril.text)}</div>
<div class="log-reward">🏆 ${esc(REWARD_LABELS[d.reward.type] || "RECURSO")}: ${esc(d.reward.text)}</div>
```

**Verify**: `grep -n 'esc(d\.\|esc(REWARD' oneshot.html` shows 5 occurrences.

## Test plan

No test infrastructure exists in this project. Manual verification:

1. Open `oneshot.html` in a browser
2. Generate a planet (use local data by not authenticating)
3. Start an expedition and generate at least one discovery
4. Complete the expedition and view the log
5. Confirm all text displays correctly (no raw HTML entities shown)

Alternatively, inject a test: temporarily add `planet.name = "<script>alert(1)</script>"`
before `showPlanetResult()`, then confirm the page shows the literal text and
does NOT execute the script.

## Done criteria

- [ ] `esc()` helper function exists near line 470 of `oneshot.html`
- [ ] `grep -n 'esc(' oneshot.html` shows 15+ calls
- [ ] Every AI-sourced value in `showPlanetResult`, `renderCurrentDiscovery`,
      and `renderLog` is wrapped in `esc()`
- [ ] `grep '${[^}]' oneshot.html` shows no remaining raw interpolations of
      AI-sourced fields (name, type, desc, approach, description, location,
      peril.text, reward.text, reward.type) — double-check any hits
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report (do not improvise) if:

- A `esc()` application is inside an attribute like `class="${...}"` — CSS
  classes should NOT be escaped (they're trusted code paths). Data attributes
  like `title="${...}"` SHOULD be escaped. If unsure, flag the line.
- The file has drifted significantly from the excerpts above (new render
  functions or refactored interpolation patterns).
- Any interpolation is found that combines AI data with HTML attributes like
  `onclick` or `onerror` — stop and escalate, that's a different fix.

## Maintenance notes

- Any new render function that displays AI-generated text must apply `esc()`.
- The `esc()` function only covers the 5 HTML-special characters. If future
  rendering uses attributes like `style` or `onclick` with AI data, a different
  approach (e.g., textContent + createElement) is needed instead.
- Polyglot/unicode-based XSS vectors (e.g., `&lt;` via double-encoding) are
  not covered — the AI would need to produce pre-escaped entities, which is
  unlikely with current prompts requesting plain text.
