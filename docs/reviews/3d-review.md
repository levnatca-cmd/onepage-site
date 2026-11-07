# 3D Engineering Console — Plan Review

Path migration note (November 5, 2026): The current plan is `docs/plans/engineering-console.md`. References to the removed `VIRAL_3D_ENGINEERING_CONSOLE_PLAN.md` are retained as historical context.

Critical review of `VIRAL_3D_ENGINEERING_CONSOLE_PLAN.md` from two lenses:
a senior architect (20 years) and a behavioral psychologist.
The goal is not to reject the plan, but to surface hidden risks, weak
assumptions, and missing structure before any code is written.

---

## TL;DR

The plan is ambitious, well-organized, and identifies a real gap
(passive site → interactive diagnostic). However, it tries to do two
products at once, over-specifies the 3D scene, under-specifies the
scoring model, and leans on fear-based psychology that is risky for a
senior B2B engineering audience. It also lacks measurable success
metrics, a performance budget, and an SEO strategy compatible with a
WebGL hero.

Recommended direction:

- Cut V1 to a single audience (product buyer).
- Reduce the 3D scene from 17 objects to ~5.
- Reframe the experience from "diagnose your fear" to "map your
  system for clarity".
- Add Non-Goals, numeric Success Metrics, Performance Budget,
  Analytics Plan, and an Anti-Barnum design constraint.

## Resolution Status — 2026-04-25

This review has been applied to the rewritten plan:
`docs/plans/engineering-console.md`.

The original `VIRAL_3D_ENGINEERING_CONSOLE_PLAN.md` has been removed
so the project has one current source of truth.

Fixed in `docs/plans/engineering-console.md`:

- [x] V1 cut to product buyer only; HR/recruiter mode deferred.
- [x] Conceptual frame changed from fear diagnostics to clarity and
      system mapping.
- [x] 3D scope reduced from 17 objects to 5 primitives.
- [x] Generic `0-100` score replaced with named system archetypes.
- [x] Added `Product System Fingerprint` as the new working concept.
- [x] Added `Product System Galaxy` as the V1 visual direction for
      the wow effect.
- [x] Added a dedicated Wow Layer: living galaxy, first-touch
      deformation, answer-driven galaxy shape, what-if simulation, and
      archetype reveal.
- [x] Added a one-page site development plan for implementing the
      experience inside the existing static site.
- [x] Added Non-Goals.
- [x] Added numeric Success Metrics.
- [x] Added Performance Budget.
- [x] Added SEO strategy for a WebGL hero.
- [x] Added Analytics Plan.
- [x] Added Anti-Barnum constraints.
- [x] Added Ethical Design Constraints.
- [x] Added Post-Result / Slack artifact strategy.
- [x] Added Brand Risks and mitigations.
- [x] Added Human Presence requirements.
- [x] Added Phase 0 paper prototype before 3D implementation.
- [x] Mailto demoted to secondary; copy-to-clipboard and visible
      contact are now required.

Deferred intentionally:

- [ ] Founder ↔ CTO mismatch detector — Phase 4/shareable state.
- [ ] Dynamic result-specific OG image — future serverless/static
      rendering work.
- [ ] Industry benchmark — only after real anonymous data exists.
- [ ] HR/corporate evaluator path — separate static page or later
      section, not part of the V1 3D flow.

---

## Part 1 — Architect's review (20 years)

### A. Architectural red flags

1. **Dual-intent in one scene = two products fused into one.**
   Product buyers and HR evaluators have different mental models,
   different pacing, and different output artifacts. Forcing them
   through the same 3D world is a UX-level "god component". Both
   audiences will end up with a compromise.

2. **17 scene objects is a zoo, not a scene.**
   Capability Matrix, Seniority Signal, Risk Pressure Ring, Timeline
   Meter, Audit Beam, Fit Packet Panel — each with its own state and
   animation. A viral landing page needs 3–5 strong primitives.
   The plan applies enterprise architecture thinking to a marketing
   surface.

3. **"Static index.html + Three.js from CDN, no build system" at this
   scope is naive.** A state machine for 17 objects, two modes,
   scoring, reduced-motion fallback, mobile fallback — this is
   effectively an SPA. Without modules and tooling, maintenance
   degenerates into a single 4k-line file.

4. **No performance budget.** A WebGL canvas in the hero will hurt
   LCP and INP unless deliberately deferred. The plan claims SEO
   intent in the same breath. We need numbers: LCP < 2.5s,
   INP < 200ms, JS budget, fallback for low-end GPUs.

5. **SEO conflict.** Three.js is not crawlable. The plan says
   "keep SEO copy below the hero", but if the hero is a heavy canvas,
   crawlers see emptiness above the fold. We need an SSR-friendly
   text layer that mirrors the meaning of the scene.

6. **Mailto as the only CTA is fragile.** Corporate browsers
   (the HR audience the plan targets) often have mailto disabled or
   bound to a desktop Outlook that does not launch. We need a
   fallback: copy-to-clipboard, visible email, simple form.

7. **Scoring model is hand-waved.** "Each symptom adds risk" is an
   intent, not a model. Without calibration, ~80% of users will
   land in the 60–80 band and the page becomes a horoscope.

8. **Phase 3 → Phase 4 is "draw the rest of the owl".** "Build the
   scene", then "bind state" are described as two steps, but the
   binding _is_ the hard part. Classic underestimate.

9. **No analytics, no operational definition of "viral".** The word
   sits in the title but no KPIs are defined: share rate,
   intent-selection ratio, drop-off per step, score distribution.
   What is not measured is not optimized.

10. **No Non-Goals and no Brand-Risk section.** For a personal
    consulting brand, the risk of looking gimmicky or
    AI-generated is real and not addressed.

### B. Topics not discussed at all

- What happens **after** the score? B2B buying is multi-touch; the
  page closes with a single CTA, contradicting its own Gartner
  citation about rep-free buying.
- Where is the **human** in this console? It is a personal brand,
  yet the consultant is abstracted into an interface.
- What about **return visits**? Is state persisted?
- What does a **cold visitor** arriving from a shared link see?

---

## Part 2 — Psychologist's review

1. **Hick's Law violated at the entry.** Forcing a binary self-
   classification (buyer / HR) before any value is shown is a
   cognitive tax during first contact. The cold visitor has not
   yet classified themselves. A third path ("explore") is needed.

2. **Barnum effect / horoscope effect.** Symptoms like "MVP works
   but breaks as usage grows" or "outages are hard to trace" are
   universal. Any founder will check 5 of 7. The score will almost
   always land in 60–80. This drives engagement but **erodes trust**
   with senior CTOs — exactly the target audience. They will
   recognize the pattern.

3. **Fear-based UX is risky in B2B engineering.** The Risk Pressure
   Ring, Timeline Meter, and "visceral pressure without text" are
   patterns from DTC categories (insurance, supplements). For a
   senior CTO they read as manipulation. The plan explicitly lists
   "Primary fears" as levers — honest in a doc, dangerous as a
   strategy.

4. **Bait-and-switch on agency.** The plan smartly raises the
   visitor's sense of control ("reveal your own pain"), then ends
   with "you have a problem, hire me". This converts agency into
   obligation. A psychologically cleaner finish gives the visitor
   something they can act on **this week, without the consultant**.
   Reciprocity drives conversion paradoxically harder than pressure.

5. **HR audience is misread.** HR and recruiters do not play with
   3D scenes. They live in 12 tabs, Cmd+F for "Toronto", "embedded",
   take a screenshot, and forward. 3D is a **barrier**, not a
   value-add. The HR mode should arguably be a static page
   (`/recruiters`) with copy-paste text and a PDF button.

6. **Memorability without affective payoff.** People share things
   that make them look smarter (status) or that solve a problem
   (utility). A score saying "your system is 42/100, fragile" is
   shame, not status. Few people forward shame to their team. The
   shareable artifact should make the **forwarder look like an
   expert** to their team.

7. **Closed loop on the score.** Open loops hold attention. Score +
   "send me this map" closes the loop for the visitor (learned →
   sent → waiting). A more durable design leaves an open artifact:
   a checklist, a mini-report that keeps working on its own.

8. **No human face.** Trust in personal brand consulting is built on
   a face, voice, and concrete history. The "console" abstracts the
   consultant into UI. This lowers trust for buyers whose decision
   model is "do I trust this person".

---

## Part 3 — Edits I would make to the plan document

### Remove or shrink

- **Drop HR mode from V1.** Move it to a separate static page
  (`/recruiters`, no 3D), or defer to a later phase. The current
  fusion weakens both products.
- **Reduce 3D objects to 5 base primitives:** System Core, Stack
  Rings, Data Streams, Fault Particles, and **one** contextual
  object (Firmware Chip / Backend Cluster / Automation Chain),
  selected by answers. Defer the other 12.
- **Drop the word "viral"** from the title. Replace with
  "Engineering Readiness Console" or "System Map". "Viral" sets
  the wrong expectations and corrupts the success criteria.

### Add new sections

1. `## Non-Goals` — what the project deliberately does NOT do
   (no PDF generation, no accounts, no wow-for-wow, no game UI).
2. `## Success Metrics (numeric)` — concrete numbers: target share
   rate, intent-selection rate, % reaching score, % clicking CTA,
   LCP, INP, mobile bounce. Without numbers, "success" is taste.
3. `## Performance Budget` — LCP < 2.5s, INP < 200ms,
   JS < 200KB gzipped, WebGL frame budget 16ms, low-GPU fallback.
4. `## SEO Strategy under WebGL hero` — text layer beneath the
   canvas, server-rendered, mirroring the scene's meaning.
   Structured data. What the crawler sees.
5. `## Analytics Plan` — events tracked, funnels measured, how
   scoring is validated (score distribution must not collapse to
   60–80).
6. `## Anti-Barnum Constraint` — design rule: different answer
   combinations must produce **visually and textually different**
   results. If 80% of users land on the same archetype, the model
   is broken.
7. `## Ethical Design Constraints` — no fear induction without
   immediate relief in the same view. No dark-pattern timeline
   pressure.
8. `## Post-Score Journey` — what happens after the score. What can
   the user do **on their own**? What second artifact arrives by
   email 24h later? This closes the open B2B loop.
9. `## Brand Risks` — looks gimmicky, looks AI-generated, looks
   like 100 other diagnostic landing pages, repels senior buyers.
10. `## Human Presence` — where the consultant's face, voice, and
    concrete work appear. The console must not depersonalize the
    brand.

### Rewrite existing sections

- **`Audience Psychology`** — rename "Primary fears" to "Primary
  tensions" and explicitly mark which we use as drivers and which
  we deliberately do NOT exploit. Make the ethical line visible
  in the document.
- **`Interaction Model`** — add a third path "Explore the system"
  before the binary choice. Segment after the first value
  contact, not before.
- **`Product Buyer Flow`**:
  - Replace "Run the system check" (diagnostic, loaded) with a
    curiosity-based headline: "Map your product system" /
    "See your system as one picture".
  - Calibrate scoring: explicitly require a spread distribution.
  - Add a free, actionable item to the result that works without
    the consultant.
- **`Implementation Phases`** — insert Phase 0:
  **paper prototype** tested on 3 real founders/CTOs before any
  code. The text of the questions and the text of the result
  matter more than the 3D.
- **`V1 Scope`** — shrink to: 1 mode (buyer), 5 questions, 5 scene
  objects, text fallback, copy-to-clipboard + visible email +
  LinkedIn. Keep mailto as a secondary, not sole, CTA.
- **`Main Risk`** — expand from one risk ("looks impressive but
  unclear") to 4–5: gimmicky, AI-look, Barnum, performance, SEO
  regression.

### Structural edits to the document

- Add a **TL;DR** at the top: 5 lines — what we build, for whom,
  how we measure it.
- Add a **Decision Log** at the bottom with dates: which decisions
  are locked, which are open.
- Move **References** to the end. They support the strategy, they
  do not define it.

---

## Part 4 — Core conceptual shift

The plan is built around **fear diagnostics**: "something is broken,
we will show it beautifully". This works in DTC and in low-trust
segments. For senior B2B engineering buyers it reads as theater.

A stronger framing is **clarity diagnostics**: "see your system as
one picture — not to be scared, but to discuss it with your team".

Consequences of the shift:

- The 3D scene becomes a thinking tool, not a fear attraction.
- Sharing becomes natural — people forward clear maps, not their
  own anxieties.
- The consultant is positioned as a cartographer of systems, not
  a fire extinguisher.
- The senior audience does not feel processed.

This shift changes the title, the headline, and the tone of voice
throughout the document.

---

## Part 5 — Virality mechanics (what is missing)

The current plan calls itself "viral" but contains no actual viral
mechanic. The word is a marketing label, not a design. People do not
forward their own fear, and a 0–100 score is not a status object.
B2B virality runs on five triggers: status currency, argument-ender,
curiosity gap, unique visual fingerprint, and inside-recognition.
The plan activates none of them.

Below are the mechanics that would make this page actually
shareable and interactive in a senior engineering audience.

### 5.1 Archetypes instead of a score (Myers-Briggs principle)

Replace `42/100` with a named archetype generated from the answers:

- `The Held-Together Empire` — many features, all on one person.
- `The Ghost MVP` — it works, nobody knows why.
- `The Spreadsheet Empire` — the business runs on Airtable and fear.
- `The Bench Hero` — works on the developer's laptop, not in prod.
- `The Handoff Black Hole` — every good thing is lost between teams.

People share archetypes, they do not share scores. Same reason
"Which Game of Thrones character are you" goes around offices and
"Health risk score: 42/100" does not.

### 5.2 Founder ↔ CTO mismatch detector

The strongest viral loop available in this niche.
The founder runs the diagnostic, gets a link to send to the CTO,
the CTO answers the same questions, and the **diff** becomes the
artifact:

`Your founder says firmware/backend handoff is fine.
 Your CTO says it is the #1 risk. Talk about that.`

One run becomes two. The mismatch is a reason to schedule a
meeting. The meeting is a reason to mention the consultant.

### 5.3 Unique visual fingerprint (system snapshot)

Not a generic 3D scene — a scene **deformed by the user's answers**.
Six selected symptoms produce six visual distortions, and the
resulting image is unique to that user. Same mechanic as Spotify
Wrapped: people share what looks unique to them.

User screenshots the scene, posts to LinkedIn or Slack with
"this is my system right now". Other founders see it, want their
own.

### 5.4 OG image and Slack-friendly preview

Every shared link must produce a working preview without a click.
OG title and image generated server-side from the result, e.g.
"X just mapped their product system. 3 critical risks identified."

Today the plan does not mention OG, embed, or social preview at
all. That kills ~70% of share potential. A B2B link that looks
broken in Slack does not get reposted.

### 5.5 Industry benchmark (FOMO trigger)

`Your firmware/backend handoff is in the bottom 30% of seed-stage
 hardware startups.`

This sentence belongs in a board deck. Founders share upward
(investors) and downward (team). A benchmark gives them a reason
for both. Implementation can start primitive: collect answers,
compute percentiles weekly.

### 5.6 Copy-paste-ready Slack message

The final artifact should be a sentence the founder can paste
verbatim into a Slack channel:

```
Hey team — I just mapped our system.
Biggest risk: firmware/backend handoff.
Worth a 30-min discussion before next sprint.
Map: <link>
```

A `Copy as Slack message` button outperforms mailto by an order
of magnitude. Mailto wants to open Outlook. A Slack-format string
is a format the forwarder already trusts.

### 5.7 "What if" simulation (visceral hook)

A button: `Simulate firmware failure` → one node breaks → the
cascade ripples across the whole scene. This is share-worthy
because it looks alive and usefully scary. The founder shows the
CTO: "this is what happens if X goes down". Argument-ender.

### 5.8 Anti-AI-slop crafted feel

In 2026, anything that looks AI-generated loses status. A
hand-crafted, weird, specific 3D scene is itself a viral signal:
"real human craft, not slop". The trend is strongest among senior
engineers — exactly the target audience. Use this lever
deliberately: imperfection, hand-tuned details, no stock assets.

### 5.9 What blocks interactivity (not just sharing)

Sharing is the second funnel. Interaction is the first. The
current plan triggers none of these:

- **First feedback in under 3 seconds** — click anything, the
  scene reacts. Not "pick a mode → start questions → get score".
- **Nonlinear exploration** — the user can poke any part of the
  scene in any order. The current flow is a linear questionnaire
  wrapped in 3D, not interactive.
- **Toggle-able alternate realities** — `What if we had no
monitoring?` switches the scene → the user sees the contrast.
  The user plays with the system instead of answering it.
- **Personal mirror** — the scene updates so the user recognizes
  _their own_ situation in the visuals. This is what holds
  attention past 30 seconds.
- **Open loops** — after the score, leave something unrevealed.
  `You unlocked 4 of 6 system zones. Want to see the other 2?`

### 5.10 What actively damages virality in the current plan

- Generic 0–100 score — not unique, not status, not shareable.
- Fear-based outcome — people do not forward their own fear.
- Mailto as the CTA — no embedded share artifact.
- No comparison flow — no two-sided loop.
- No archetypes — no result identity.
- No OG / embed — every shared link looks dead in Slack.
- HR mode in the same UI — destroys focus for both audiences.
- 17 scene objects — nobody decodes what is unique to them.

### 5.11 One-sentence summary

The current plan is a diagnostic questionnaire wrapped in 3D.
The viral version is a generator of a unique system fingerprint
with an archetype, a founder↔CTO compare flow, and a
Slack-ready artifact on output. The 42/100 score is not needed
at all.

---

## Part 6 — Suggested next decision

Status: completed in `docs/plans/engineering-console.md`.

Before any code, these three things needed to be locked:

1. **Audience priority for V1**: product buyer only, HR deferred.
2. **Conceptual frame**: clarity, not fear.
3. **Scope ceiling for V1**: 5 questions, 5 scene primitives,
   1 result page, text-first fallback.

They are now locked in the rewritten plan. The next project step is
Phase 0: paper prototype the five questions, archetypes, and Slack
artifact before writing production 3D code.
