---
name: three-scene-edit
description: Add, remove, or modify entities in the Three.js "Website System Galaxy" scene in src/galaxy/js with its HTML controls in index.html. Use when the user wants to add a planet, choice object, scenario, archetype, scale stage, or motion group — or rename/retune any of these. Knows the cross-referenced registries so changes stay consistent across PLANETS / SCORE_MAP / QUESTION_FLOW / CHOICE_VISUALS / CHOICE_MOTION_GROUPS / SCENARIOS / ARCHETYPES and the corresponding HTML form/buttons. Triggers: "add planet", "new choice object", "edit scenario", "add archetype", "tune galaxy".
tools: Read, Grep, Edit, Bash
---

# Three Scene Edit

The 3D galaxy in `src/galaxy/js/galaxy.js` and the root `index.html` is driven by ~7 interconnected registries. Edit one in isolation and the scene breaks silently (no scoring, no motion, no label, no DOM mirror). This skill enforces the cross-references.

## Registries and what they each control

Registries live in `src/galaxy/js/data/quiz-data.js`. The palette is in `src/galaxy/js/data/config.js`; rendering is in `src/galaxy/js/galaxy.js` and `src/galaxy/js/scene/`. HTML controls remain in the root `index.html`. Use the registry names to locate current definitions rather than historical line numbers.

| Registry | Source | Purpose |
|---|---|---|
| `PLANETS` | `src/galaxy/js/data/quiz-data.js` | The 6 service bodies. Keys also drive `data-planet=` HTML buttons. Fields: `label, short, role, links, risk, copy, color, radius, size, speed, angle, inclination`. |
| `SCORE_MAP` | `src/galaxy/js/data/quiz-data.js` | Each answer value (and planet id) contributes points to archetypes (`bench`, `handoff`, `spreadsheet`, `ghost`, `ops`). |
| `QUESTION_FLOW` | `src/galaxy/js/data/quiz-data.js` | 5 questions q1–q5, each with `choices: [{ value, label, tag }]`. Mirrored in the HTML radio form. |
| `CHOICE_VISUALS` | `src/galaxy/js/data/quiz-data.js` | For every choice value (and planet id), defines the 3D object kind, accent color, and `labelY`. The `kind` string must match a builder function in the scene factory. |
| `CHOICE_MOTION_GROUPS` | `src/galaxy/js/data/quiz-data.js` | Groups of `kind` names by animation behavior (`spin`, `sweep`, `orbit`, `incident`, `stack`, `bridge`, `cluster`). A kind without a group renders static. |
| `SCALE_STAGES` | `src/galaxy/js/data/quiz-data.js` | 4 stages of system pressure used by the scale slider. |
| `SCENARIOS` | `src/galaxy/js/data/quiz-data.js` | The 4 motion-preview cards. Each links to a `simulation`, `archetype`, `planet`, and copy. Keys are mirrored in `data-scenario=` HTML buttons. |
| `ARCHETYPES` | `src/galaxy/js/data/quiz-data.js` | The 5 result archetypes. `focus` must reference a valid PLANET key. |

(Line numbers drift as edits land. **Always re-grep** at the start of every run — see Step 1 below.)

## Procedure

### Step 1 — Locate current ranges

Don't trust the numbers above blindly. Re-find each registry's start line every time the skill runs:

```bash
rg -n "export const (PLANETS|SCORE_MAP|QUESTION_FLOW|CHOICE_VISUALS|CHOICE_MOTION_GROUPS|SCALE_STAGES|SCENARIOS|ARCHETYPES)" src/galaxy/js/data/quiz-data.js
```

Also re-find the HTML mirrors:

```bash
grep -n "data-planet=\|data-scenario=\|name=\"q[0-9]" index.html | head -40
```

### Step 2 — Plan the edit

Decide which registries are affected by the user's request. Use this dependency map:

**Adding a new planet `X`:**
1. `PLANETS[X] = {...}` — full field set
2. `SCORE_MAP[X] = {...}` — what answering this in q1 scores
3. `CHOICE_VISUALS[X] = {...}` — 3D object kind for the q1 selection
4. HTML: new `<button class="layer-button" data-planet="X">…</button>` in `.layer-strip`
5. HTML: new `<label class="answer-option"><input type="radio" name="q1" value="X" /> …</label>` in q1 fieldset
6. Optionally: link from one or more `ARCHETYPES[*].focus`

**Adding a new choice `Y` to question `qN`:**
1. `QUESTION_FLOW[N-1].choices.push({ value: "Y", label, tag })`
2. `SCORE_MAP[Y] = {...}` — archetype contributions
3. `CHOICE_VISUALS[Y] = { kind: "...", accent: ..., labelY: ... }`
4. HTML: new `<label class="answer-option"><input type="radio" name="qN" value="Y" /> …</label>` in the corresponding fieldset
5. If `kind` is new: add a builder for it in the JS scene factory **and** add it to one of `CHOICE_MOTION_GROUPS` (or it will render static)

**Adding a new scenario `Z`:**
1. `SCENARIOS[Z] = { label, simulation, archetype, planet, copy }`
2. HTML: new `<button class="scenario-card" data-scenario="Z">…</button>` in `.scenario-grid`
3. `archetype` must exist in `ARCHETYPES`; `planet` must exist in `PLANETS`

**Adding a new archetype `A`:**
1. `ARCHETYPES[A] = { name, focus, summary, gaps[], action, simulation }`
2. `focus` must be an existing `PLANETS` key
3. At least one `SCORE_MAP` entry should award points to `A` — otherwise it will never be selected as the result

**Adding a new motion `kind`:**
1. Add the string to one of `CHOICE_MOTION_GROUPS` sets (or animation will be a no-op)
2. Confirm there is a builder in the scene factory that produces a mesh for it — grep for the existing kinds to find the factory: `grep -n "kind === \"" index.html` or `grep -n "case \"" index.html` in `src/galaxy/js/galaxy.js`

### Step 3 — Apply

- Use `Edit` for every change. One logical change per edit.
- Preserve the existing formatting (2-space indent, trailing commas where present).
- Don't re-order existing entries.

### Step 4 — Validate

Run `npm run test:galaxy` from the repository root before the targeted checks below.

Run consistency checks (treat any miss as a blocker the user must approve before commit):

```bash
# Every data-planet button has a PLANETS entry (and vice versa)
grep -oE 'data-planet="[^"]+"' index.html | sort -u
rg -n "export const PLANETS" src/galaxy/js/data/quiz-data.js  # rough scan of PLANETS keys — adjust as needed

# Every q* radio value appears in QUESTION_FLOW choices (and vice versa)
grep -oE 'name="q[0-9]" value="[^"]+"' index.html | sort -u

# Every data-scenario button matches a SCENARIOS key
grep -oE 'data-scenario="[^"]+"' index.html | sort -u

# Every CHOICE_VISUALS kind is referenced by the scene factory (look for the switch / lookup table inside the JS)
rg -o 'kind: "[^"]+"' src/galaxy/js/data/quiz-data.js | sort -u
```

Report anything that has no mirror. Common failure modes:
- New planet added but no `.layer-button` → button strip silently misses an entry
- New choice added but no radio in the form → JS state never sees it
- New `kind` without a builder → 3D object never renders
- New `kind` without a motion group → object renders but is frozen
- New archetype with no `SCORE_MAP` contributions → unreachable result

### Step 5 — Briefly summarize

Tell the user:
- What was added/changed (and where: file:line)
- What still needs the user's eyes (e.g., copy review, picking a `kind` builder, choosing a hex color)

## Notes

- The `color` field in `PLANETS` and the `accent` field in `CHOICE_VISUALS` are **integers** (hex literals like `0x5de7ff`), not strings. Don't quote them.
- `VISUAL_COLORS` (in `src/galaxy/js/data/config.js`) is the palette source — prefer referencing those over raw hex when adding entries.
- The scene factory (the function that maps a `kind` string to actual Three.js geometry) is large. To find it: `grep -n "function build\|createChoice\|kindBuilder" src/galaxy/js/galaxy.js`. Read the relevant builder before adding a new `kind` so you produce a mesh in the same style.
- This skill does NOT cover post-processing, shaders, or GLTF imports. Those are separate concerns (and possibly separate skills).
- Do not commit. Leave that to the user.
