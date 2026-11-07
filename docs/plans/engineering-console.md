# Engineering Console Plan

## TL;DR

Build a `Product System Galaxy`: a focused, 3D, self-service one-page experience for founders, CTOs, and product leads who need to see where their product system lacks engineering ownership.

The result artifact is still the `Product System Fingerprint`. The visual interface is now a living galaxy: a central product star, orbiting system planets, moving data streams, and answer-driven distortions.

V1 is not a quiz with a scary score. It is a clarity tool:

- One audience: product buyers.
- One frame: map the system, do not shame the visitor.
- Five questions.
- Five galaxy primitives.
- One result: a named system archetype, ownership gaps, and a Slack-ready artifact.
- One wow layer: immediate motion, orbit deformation, a short what-if simulation, and a screenshot-worthy final reveal.

HR/recruiter evaluation is deferred. It should become a separate static page or section later, not part of the 3D experience.

## Locked Decisions

- V1 serves product buyers only: founders, CTOs, product owners, hardware/SaaS leads.
- The experience is framed around clarity, not fear.
- The output is an archetype and system fingerprint, not a generic `0-100` score.
- The final artifact must be easy to paste into Slack or send to a team.
- Three.js is an enhancement; the HTML text layer must carry the meaning without WebGL.
- The scene must be simple enough to understand in under 10 seconds.
- The V1 visual language is `Product System Galaxy`, not a generic dashboard or generic space wallpaper.

## Working Name

Recommended product name:

`Product System Fingerprint`

Recommended visual concept:

`Product System Galaxy`

Other acceptable names:

- `Product System Map`
- `Engineering Ownership Map`
- `System Ownership Fingerprint`
- `Engineering Galaxy Map`

Avoid:

- `Crash Test`
- `Fragility Score`
- `Viral 3D Console`
- `Risk Pressure Console`
- `Generic Space Dashboard`

Reason:

Senior B2B buyers share clarity, not fear. The experience should feel visually memorable, but the output should still feel like a useful internal artifact, not a marketing toy.

## Product Goal

The page should make a product buyer think:

`This shows my system clearly enough that I can send it to my team.`

Secondary goal:

`This consultant understands cross-stack product systems and could help us discuss the hard parts.`

The site should still sell consulting, but by giving the visitor a useful artifact first.

## Non-Goals

V1 does not include:

- HR/recruiter mode.
- User accounts.
- Backend storage.
- PDF generation.
- Dynamic OG image generation.
- Industry benchmarks based on fake data.
- Complex physics.
- Heavy imported 3D models.
- Game-like controls.
- 17-object architecture diagrams.
- Fear-based countdowns or dark-pattern urgency.

## Audience

### Primary Audience

Product buyers:

- Founder
- CTO
- Product owner
- Hardware lead
- SaaS lead
- Operations lead

### Primary Tensions

These are real pressures, but the interface should not exploit them aggressively:

- The product spans firmware, backend, automation, data, and operations.
- No single person owns the whole system.
- The MVP works, but the team is unsure what breaks at scale.
- Handoffs between teams or vendors are unclear.
- Automation and internal workflows became hidden infrastructure.
- Production issues are hard to trace.

### What The Experience Should Provide

- A shared picture.
- A named system pattern.
- Specific ownership gaps.
- A team-ready summary.
- A low-pressure next step.

## Conceptual Frame

Old frame:

`Diagnose your fear.`

New frame:

`See your product system as one picture.`

The 3D scene is a thinking tool. It should help the visitor discuss their system with another person.

Visual metaphor:

`Your product is a galaxy. Each system layer is a planet. Delivery depends on the gravity, orbit, and data streams between them.`

The cosmic layer creates the wow effect, but every motion must still explain something about the system.

Recommended hero headline:

`See your product system as one picture.`

Supporting copy:

`Map the ownership gaps across firmware, backend, automation, data, and operations before they slow delivery.`

Primary CTA:

`Create system fingerprint`

Secondary CTA:

`Explore the system map`

Optional hero microcopy:

`Watch the system move before you answer anything. Then create your fingerprint.`

## Page Structure

1. Text-first hero over or beside a full-bleed `Product System Galaxy`.
2. Immediate interaction: hover/click a planet or orbit and see feedback.
3. Five-question fingerprint builder.
4. Galaxy deforms based on answers.
5. Short what-if simulation for the dominant archetype.
6. Final galaxy pose with archetype, ownership gaps, and Slack-ready summary.
7. Services reframed around the discovered ownership gaps.
8. Process section.
9. Contact section.
10. SEO text and structured content.

## Interaction Principles

### First Feedback In Under 3 Seconds

The first visible interaction must happen immediately:

- Hover a layer.
- Click a layer.
- Toggle a sample scenario.
- Select the first question.

The scene must react before the visitor commits to the full flow.

### Nonlinear Exploration

The user should be able to inspect the scene without answering the questionnaire:

- Firmware
- Backend
- Automation
- Data
- Ops

This prevents the experience from feeling like a linear quiz wrapped in 3D.

### Personal Mirror

The scene changes in a way that reflects the user's answers:

- More handoff issues create visible gaps between layers.
- Automation dependency bends or thickens the automation path.
- Production visibility issues dim the ops layer.
- Firmware/backend mismatch distorts the gateway between those layers.

### Team Artifact

The output must be copyable:

- `Copy as Slack message`
- `Copy summary`
- Visible email fallback
- Optional mailto link

Mailto is secondary, not the main conversion mechanism.

## Wow Layer

The site still needs a strong wow effect. The wow should come from meaningful motion and a unique visual fingerprint, not from random decoration.

### 1. Living Galaxy On Load

The hero opens with a slow-moving product galaxy:

- Central product star pulses subtly.
- System planets orbit at different speeds.
- Data streams move between planets.
- Small signal flares appear where paths connect.

The motion should feel precise and engineered, not like a generic space screensaver.

### 2. First Touch Deformation

Within the first interaction:

- Hovering a planet reveals its layer.
- Clicking a planet pulls it slightly forward.
- Its related data streams brighten.
- The HTML copy changes to explain the layer.

This gives the user proof that the scene is alive before the questionnaire starts.

### 3. Answer-Driven Galaxy Shape

Each answer changes the galaxy:

- Ownership gaps shift planets out of alignment.
- Firmware/backend mismatch bends the bridge between those planets.
- Automation dependency creates a dense belt of small task debris.
- Weak production visibility pushes the Ops planet into a dim outer orbit.
- Cross-stack ownership need pulls multiple planets toward one shared orbit.

The final screenshot should look unique to the visitor's answers.

### 4. What-If Simulation

After the fifth question, the page runs one short simulation based on the dominant archetype.

Examples:

- `Simulate handoff failure`: signal leaves Firmware, gets distorted at Backend, then reaches Ops late.
- `Simulate automation overload`: task debris clogs the Automation orbit and slows Data.
- `Simulate production blind spot`: a failure flare happens near Device, but Ops receives it too late.

The simulation should last 3-5 seconds and then settle into the final fingerprint pose.

### 5. Archetype Reveal

The final reveal should feel like a polished moment:

- Camera eases into the dominant planet/anomaly.
- The galaxy settles into its unique shape.
- The archetype name appears in real HTML text.
- The result panel becomes copyable.

This is the screenshot-worthy moment.

### 6. Crafted Feel

Avoid AI-slop and stock-space aesthetics:

- Use simple geometry with hand-tuned motion.
- Keep the palette restrained: deep graphite, cyan, white, amber, occasional red/orange for attention.
- No generic purple nebula wallpaper.
- No random stars that do not support depth or motion.
- No uncontrolled particle explosions.

## 3D Scene Scope

V1 uses five galaxy primitives.

### 1. Product Star

Represents the product as a whole.

Visual:

- Central star or reactor-like core.
- Stable, hand-crafted, non-stock look.
- Subtle pulse, not aggressive alarm behavior.

State:

- Neutral by default.
- Becomes more segmented when ownership is fragmented.
- Color and shape change based on the resulting archetype.

### 2. System Planets And Orbits

Represents the major layers of the product system.

Planets:

- Device / firmware
- API / backend
- Data
- Automation
- Operations

Visual:

- Planets orbit around the Product Star.
- Each planet has a simple visual identity.
- Orbit paths replace generic stack rings.
- Labels are real DOM text where possible, not only canvas pixels.

State:

- Selected planets move forward or brighten.
- Ownership gaps appear as orbital misalignment, tilt, or distance.
- The dominant archetype changes the planet arrangement.

### 3. Light Bridges

Represents information, commands, events, and handoffs.

Visual:

- Curved light bridges between planets.
- Small moving signal particles travel along them.

State:

- Smooth stream: stable handoff.
- Offset stream: unclear ownership.
- Broken stream: handoff gap.
- Congested stream: automation or manual process dependency.
- Delayed stream: production visibility or ops lag.

### 4. Signal Flares And Debris

Represents areas that need discussion.

Visual:

- Small hand-tuned signal flares, dust, or debris.
- Should look crafted, not generic AI sci-fi noise.

State:

- Appears near planets affected by answers.
- Count is limited to avoid visual chaos.
- Never becomes a fear-inducing explosion.

### 5. Dominant Anomaly

Only one contextual anomaly is emphasized at a time.

Possible anomalies:

- Firmware planet close-up
- Backend gravity well
- Automation debris belt
- Ops shadow orbit
- Handoff black-hole distortion

Selection logic:

- The dominant archetype decides which anomaly appears in focus.
- The other system layers remain visible as planets and orbits.

Reason:

The user should understand one main system story, not decode 17 animated objects.

## Deferred 3D Objects

These are not V1:

- Capability Matrix
- Seniority Signal
- Risk Pressure Ring
- Timeline Meter
- Audit Beam
- Fit Packet Panel
- Separate HR scene
- Full dashboard simulation
- Industry benchmark overlay

They can be revisited only after the core fingerprint experience proves useful.

## Fingerprint Questions

Questions should be specific enough to avoid the Barnum effect.

V1 uses five questions:

1. `Which part most often slows delivery?`
   - Firmware / device behavior
   - Backend / API changes
   - Internal automation
   - Data / reporting
   - Production visibility

2. `Where does ownership get unclear?`
   - Between hardware and firmware
   - Between firmware and backend
   - Between backend and operations
   - Between business process and automation
   - No clear owner for the full system

3. `What changed since the MVP started working?`
   - More users
   - More devices
   - More manual work
   - More integrations
   - More production incidents

4. `What does the team usually do when something breaks?`
   - Check logs and dashboards
   - Ask the person who built it
   - Retry the workflow manually
   - Patch one layer and hope
   - Debate which layer owns it

5. `What would make the next 30 days easier?`
   - Clear architecture map
   - Stabilized firmware/backend handoff
   - Less manual operations
   - Better monitoring
   - One engineer owning the cross-stack path

## Archetypes

The result is a named archetype, not a score.

### The Handoff Black Hole

Pattern:

- The product crosses layers, but ownership disappears between teams.

Typical signs:

- Firmware/backend mismatch.
- Integration delays.
- Debates over which layer owns a bug.

Scene fingerprint:

- Firmware and Backend planets drift into different orbital planes.
- The light bridge between them bends into a small black-hole distortion.
- Dominant anomaly: handoff black-hole distortion.

Useful next action:

- Write a one-page ownership map for the firmware/backend/API path.

### The Ghost MVP

Pattern:

- The MVP works, but the team cannot confidently explain why.

Typical signs:

- One person knows the system.
- Debugging depends on memory.
- Changes feel risky.

Scene fingerprint:

- Product Star is partially occluded by a dim shell.
- Signal flares appear around hidden or undocumented paths.
- Dominant anomaly: Backend gravity well.

Useful next action:

- Document the current system path from user action to production outcome.

### The Spreadsheet Empire

Pattern:

- Business operations depend on spreadsheets, Airtable, Zapier, or manual glue.

Typical signs:

- Manual reconciliation.
- Workflow retries.
- Reporting does not match reality.

Scene fingerprint:

- Automation planet develops a dense debris belt of manual tasks.
- Data light bridges become thick and congested.
- Dominant anomaly: Automation debris belt.

Useful next action:

- Identify the top three manual workflows that now behave like infrastructure.

### The Bench Hero

Pattern:

- The device or product works in controlled conditions but struggles in production.

Typical signs:

- Device behavior differs in the field.
- Connectivity or update issues.
- Production feedback arrives through support.

Scene fingerprint:

- Device/Firmware planet glows strongly but sits far from the Ops orbit.
- Light bridges pulse unevenly between Device, Firmware, and Backend.
- Dominant anomaly: Firmware planet close-up.

Useful next action:

- Map device state, telemetry, update path, and production observability together.

### The Ops Blind Spot

Pattern:

- The system operates, but visibility is too weak to diagnose failures quickly.

Typical signs:

- Incidents are hard to trace.
- Support finds bugs before engineering.
- Logs exist but do not answer product-level questions.

Scene fingerprint:

- Ops planet moves into a dim outer orbit.
- Signal flares arrive late near the end of light bridges.
- Dominant anomaly: Ops shadow orbit.

Useful next action:

- Define three production questions the system must answer in under five minutes.

## Anti-Barnum Constraint

The result model is broken if most users receive the same archetype.

Rules:

- Different answer combinations must create visibly different scene shapes.
- Different archetypes must produce different text.
- Questions must force tradeoffs, not allow every visitor to check every box.
- No universal statements like "your system has hidden technical debt" as the main result.
- Result copy must reference the user's specific selected pattern.

## Result Panel

The result panel includes:

- Archetype name.
- One-sentence diagnosis framed as clarity, not shame.
- Three ownership gaps.
- One useful action the visitor can take without hiring anyone.
- `Copy as Slack message`.
- `Copy summary`.
- Visible email.
- Secondary `Discuss this map` CTA.

Example:

```text
Your system fingerprint: The Handoff Black Hole

The product depends on firmware/backend coordination, but ownership is unclear at the handoff.

Ownership gaps:
- Firmware events and backend expectations are not mapped as one path.
- Production issues can bounce between teams before someone owns them.
- Delivery slows when integration context lives in people's heads.

Useful next action:
Map the device event -> API -> backend state path on one page before the next sprint.
```

## Slack Artifact

The final artifact should make the sender look useful, not panicked.

Template:

```text
Hey team - I mapped our product system.
Fingerprint: The Handoff Black Hole.
Main discussion point: firmware/backend ownership.
Useful next step: map device event -> API -> backend state before the next sprint.
Map: <link>
```

For V1, `<link>` can be the site URL. If local state is encoded in query params later, it can become a shareable result link.

## CTA Strategy

Primary post-result CTA:

`Discuss this system map`

Secondary actions:

- `Copy as Slack message`
- `Copy summary`
- `Email this map`

Visible contact fallback:

- `info@levnat.ca`

Mailto body should include:

- Archetype.
- Selected answers.
- Ownership gaps.
- Request to discuss the map.

## Founder / CTO Compare Flow

This is a strong Phase 2 idea, not V1.

Concept:

- Founder creates a fingerprint.
- Founder sends the same map to CTO.
- CTO answers the same questions.
- The product shows the mismatch:

```text
Founder view: firmware/backend handoff is stable.
CTO view: firmware/backend handoff is the main delivery risk.
```

Why defer:

- Needs persistent state or encoded links.
- Needs careful privacy behavior.
- Needs a stronger result model.

## Dynamic OG / Social Preview

This is Phase 2 or Phase 3.

V1 should still include a strong static OG image and title.

Future:

- Result-specific OG title.
- Result-specific image.
- Slack/LinkedIn preview showing archetype and system fingerprint.

Do not fake dynamic previews on a purely static site.

## Industry Benchmark

This is deferred until real data exists.

Do not claim:

`bottom 30% of seed-stage hardware startups`

unless the dataset exists.

Possible future:

- Anonymous answer collection.
- Weekly percentile computation.
- Clear sample-size disclosure.

## Human Presence

The console must not hide the consultant behind the interface.

Add below or beside the result:

- Short founder/consultant note.
- Clear statement of how the work is done.
- Real name and professional links when available.
- Concrete examples or case studies when available.

Suggested copy direction:

`I build and stabilize product systems where firmware, backend, automation, and operations have to work as one path.`

## Services Reframe

Services should map to ownership gaps:

- Firmware/backend handoff ownership.
- Backend/API platform ownership.
- Automation and data workflow ownership.
- Production visibility and operations ownership.
- System architecture map and stabilization.

Remove or heavily reduce unrelated social media system messaging from the main conversion path.

## SEO Strategy Under WebGL Hero

WebGL is not the SEO layer.

Requirements:

- Hero headline and supporting copy are real HTML text.
- Primary services appear as crawlable text below the hero.
- The canvas has an accessible label or is marked decorative where appropriate.
- Structured data stays valid.
- WebGL loads after meaningful text is available.
- Site remains understandable if JavaScript fails.

SEO text should keep these themes:

- Systems engineering consultant Toronto.
- Embedded firmware development.
- Backend/API engineering.
- Automation engineering.
- Hardware-software integration.
- Product system architecture.

## Performance Budget

Targets:

- LCP under 2.5s on a normal mobile connection.
- INP under 200ms.
- WebGL frame budget near 16ms on desktop.
- Mobile canvas should reduce particle count and animation work.
- JavaScript should stay small enough for a static one-page site.
- WebGL should not block reading or CTA interaction.

Implementation rules:

- Use simple geometries.
- Avoid heavy textures.
- Avoid large model files.
- Avoid expensive post-processing in V1.
- Respect `prefers-reduced-motion`.
- Provide low-GPU fallback.

## Accessibility

The 3D scene cannot be the only interface.

Requirements:

- All questions are real HTML controls.
- Results are real text in the DOM.
- Keyboard users can complete the flow.
- Copy buttons have clear labels.
- Reduced-motion mode disables nonessential animation.
- Color is not the only signal for state.
- Canvas does not trap focus.

## Analytics Plan

Track:

- Hero interaction within first 3 seconds.
- Started fingerprint.
- Completed each question.
- Archetype generated.
- Copy as Slack message clicked.
- Copy summary clicked.
- Email CTA clicked.
- Contact link clicked.
- Device type and reduced-motion mode.

Validate:

- Archetype distribution does not collapse into one result.
- Users complete the flow without needing the 3D to explain basic meaning.
- Copy/share actions happen more often than mailto clicks.
- Mobile users do not bounce because of performance.

## Success Metrics

Initial targets:

- 50%+ of engaged visitors interact with the system map.
- 35%+ of starters complete the five-question flow.
- 10%+ of completed results use copy/share action.
- Contact CTA is secondary but should remain visible.
- No major LCP/INP regression versus the current static page.

These are starting targets, not promises.

## Ethical Design Constraints

- Do not manufacture urgency.
- Do not make the visitor feel embarrassed to share the result.
- Do not use fake benchmarks.
- Do not use a fear score as the main result.
- Always provide a useful next action that works without hiring the consultant.

## Brand Risks

Risks:

- Looks gimmicky.
- Looks AI-generated.
- Looks like a generic diagnostic landing page.
- WebGL hurts performance.
- Senior engineers dismiss it as theatre.
- The artifact is too vague to share.

Mitigations:

- Keep the scene sparse and specific.
- Use hand-tuned details.
- Tie every animation to user input.
- Keep result text concrete.
- Keep human presence visible.
- Make HTML useful without the canvas.

## One-Page Site Development Plan

The implementation target is still a one-page static site.

Primary file:

- `index.html`

Optional later files:

- `og-image.png` for static sharing preview.
- Local `vendor/three/three.module.min.js` only if CDN loading becomes a performance or reliability issue.

No backend is required for V1.

### One-Page Structure

The page should be organized as one continuous experience:

1. `Header`
   - Brand.
   - Anchor links.
   - Primary CTA: `Create fingerprint`.

2. `Hero / Product System Galaxy`
   - Real HTML headline and supporting copy.
   - Full-bleed or wide 3D canvas.
   - Immediate layer exploration.
   - CTA buttons.

3. `Galaxy Explorer`
   - Small panel listing system planets:
     - Firmware
     - Backend
     - Automation
     - Data
     - Ops
   - Hover/click changes focused planet.
   - This is available before the questionnaire.

4. `Fingerprint Builder`
   - Five HTML questions.
   - One active question at a time on mobile.
   - Compact stepper on desktop.
   - Every answer updates galaxy state immediately.

5. `What-If Simulation`
   - Runs after the fifth answer.
   - Uses the dominant archetype.
   - Lasts 3-5 seconds.
   - Settles into final screenshot-worthy galaxy pose.

6. `Result / Fingerprint`
   - Archetype name.
   - Ownership gaps.
   - Useful next action.
   - `Copy as Slack message`.
   - `Copy summary`.
   - `Discuss this map`.

7. `Services`
   - Services mapped to ownership gaps, not generic categories.

8. `Process`
   - How a real engagement works after the map.

9. `Contact`
   - Visible email and phone.
   - Mailto with archetype and answers when available.

10. `SEO Footer`

- Crawlable service and location text.

### HTML Requirements

The one-page site must remain meaningful without WebGL.

Required HTML elements:

- Real `h1` for the hero.
- Real text for all questions and results.
- Real buttons for every action.
- A visible fallback if Three.js fails.
- `aria-live` region for result updates.
- Canvas marked as enhancement, not the only source of information.

### CSS Architecture

Keep CSS grouped by surface:

- Root variables.
- Base layout.
- Header/nav.
- Hero and galaxy shell.
- Explorer controls.
- Fingerprint builder.
- Result panel.
- Services/process/contact.
- Responsive rules.
- Reduced-motion rules.

Visual rules:

- The galaxy can be full-bleed, but controls must stay readable.
- Do not place text inside decorative nested cards.
- Keep buttons stable in size.
- Keep mobile controls compact and stacked.
- The final result should look good as a screenshot.

### JavaScript Architecture

Keep the one-page JavaScript structured even if it stays inside `index.html`.

Suggested data constants:

- `PLANETS`
- `QUESTIONS`
- `ARCHETYPES`
- `SCENE_STATES`
- `CONTACT_CONFIG`

Suggested state object:

```js
const appState = {
  selectedPlanet: null,
  answers: {},
  archetype: null,
  simulation: null,
  reducedMotion: false,
  webglReady: false,
};
```

Suggested functions:

- `initApp()`
- `initGalaxyScene()`
- `createProductStar()`
- `createSystemPlanets()`
- `createLightBridges()`
- `createSignalFlares()`
- `focusPlanet(planetId)`
- `recordAnswer(questionId, answerId)`
- `classifyArchetype(answers)`
- `deriveGalaxyState(archetype, answers)`
- `updateGalaxyVisuals(galaxyState)`
- `runWhatIfSimulation(archetype)`
- `renderResult(archetype, answers)`
- `buildSlackMessage(archetype, answers)`
- `buildMailto(archetype, answers)`
- `copyText(text)`

Rule:

The classifier should not live inside the animation code. The 3D scene reads a derived state; it does not decide the business logic.

### Three.js Implementation Strategy

Use simple procedural geometry:

- Product Star: sphere or faceted polyhedron with emissive material.
- Planets: small spheres or low-poly objects with distinct materials.
- Orbits: thin line loops.
- Light Bridges: curves with moving particles.
- Debris Belt: instanced small points around Automation.
- Shadow Orbit: dim material and slower motion for Ops.
- Black-Hole Distortion: dark disk/ring plus curved bridge pull.

Avoid:

- Imported models.
- Heavy textures.
- Expensive postprocessing.
- Physics engines.
- Random decorative nebula backgrounds.

Camera:

- Default: angled view of the whole galaxy.
- Planet focus: short eased camera move.
- Result reveal: camera settles on the dominant anomaly.

Motion:

- Always running, but subtle.
- Reduced on mobile.
- Disabled or simplified when `prefers-reduced-motion` is active.

### State To Visual Mapping

Examples:

- Handoff issue:
  - Firmware and Backend planets tilt into different planes.
  - Light bridge bends through a dark distortion.

- Automation issue:
  - Automation planet gains debris belt.
  - Data bridge becomes congested.

- Production visibility issue:
  - Ops planet moves outward and dims.
  - Signals arrive late.

- Ghost MVP:
  - Product Star gets a partial shell.
  - Hidden-path flares appear.

- Bench Hero:
  - Device/Firmware planet glows strongly.
  - Ops orbit stays distant.

### One-Page Development Order

Build in this order:

1. Static HTML skeleton for all sections.
2. Question data and archetype classifier.
3. Result panel and copy buttons.
4. CSS layout and responsive behavior.
5. Three.js scene with neutral galaxy.
6. Planet hover/click focus.
7. Answer-driven visual states.
8. What-if simulation.
9. Mailto and contact hydration.
10. Accessibility, performance, and mobile verification.

This order keeps the page useful before the 3D is finished.

## Implementation Phases

### Phase 0: Paper Prototype

Before 3D implementation:

- Test the five questions as plain text.
- Test the archetype outputs.
- Show the Slack artifact format.
- Ask whether a founder/CTO would forward it internally.

Minimum validation:

- 3 real or representative product buyers.

### Phase 1: Text-First Interactive UI

Build:

- Hero copy.
- Five questions.
- Archetype classifier.
- Result panel.
- Copy buttons.
- Mailto fallback.

No 3D yet.

### Phase 2: 3D Scene V1

Build:

- Product Star.
- System Planets And Orbits.
- Light Bridges.
- Signal Flares And Debris.
- Dominant Anomaly.

Bind:

- Answers deform the galaxy.
- Archetype changes shape/color/focus.
- Hover/click feedback works immediately.

### Phase 3: Conversion And SEO Integration

Build:

- Services mapped to ownership gaps.
- Contact CTA aligned to system map.
- Static OG image.
- Structured content and text fallback.
- Performance tuning.

### Phase 4: Shareable State

Possible later:

- Query-param encoded result.
- Founder/CTO compare flow.
- Result-specific Slack/LinkedIn copy.
- Dynamic OG if using serverless rendering.

### Phase 5: Benchmarks

Only after collecting real anonymous data:

- Archetype distribution.
- Optional benchmark copy.
- Clear sample size disclosure.

## V1 Scope Ceiling

V1 includes:

- One audience.
- Five questions.
- Five galaxy primitives.
- Five archetypes.
- One result panel.
- Copy as Slack message.
- Copy summary.
- Visible email.
- Secondary mailto.
- SEO-safe text layer.
- Reduced-motion and mobile fallback.

V1 does not expand until the core artifact is useful.

## Decision Log

### 2026-04-25

Locked:

- Product buyer first.
- HR deferred.
- Clarity over fear.
- Archetypes over scores.
- System fingerprint over questionnaire.
- Product System Galaxy as the V1 visual language.
- Five galaxy primitives.
- Wow layer with immediate motion, answer-driven deformation, what-if simulation, and final reveal.
- Slack-ready output.

Open:

- Exact archetype names.
- Whether to keep `Systems Engineering` as visible brand name or foreground `Levnat`.
- Whether Phase 0 is done with real people before code or simulated internally first.

## References

- Gartner, 2025: 61% of B2B buyers prefer an overall rep-free buying experience.
  https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-sales-survey-finds-61-percent-of-b2b-buyers-prefer-a-rep-free-buying-experience
- 6sense, 2025 B2B Buyer Experience Report.
  https://6sense.com/science-of-b2b/the-2025-b2b-buyer-experience-report/
- Consensus, 2025 Buyer Behavior Report.
  https://goconsensus.com/research/2025-b2b-buyer-behavior-report/
