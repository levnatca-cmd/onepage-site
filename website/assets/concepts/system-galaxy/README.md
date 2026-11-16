# System Galaxy Concept Plates

The current Core reference is [Idle Plasma](core-idle-plasma.png). The [Core object](../../../src/galaxy/js/scene/core-object.js) renders the plasma in Galaxy and in the [model review](../../../prototypes/galaxy-model-review/index.html?service=core). Plate 01 is the earlier routing concept.

The renderer uses a [compressed copy](../../images/galaxy-core-plasma.webp) for the fine plasma filaments. The volume shader supplies the glow and fills in the plasma when the texture is unavailable or the sphere is viewed from the side.

1. `01-central-system-core.png` - **CENTRAL SYSTEM CORE**  
   Routes verified signals across every system domain.
2. `02-interface-app.png` - **INTERFACE / APP**  
   The spatial surface where people enter and control the system.
3. `03-backend-api.png` - **BACKEND / API**  
   Logic, services, and gateways coordinate every system action.
4. `04-automation.png` - **AUTOMATION**  
   Repeatable workflows move actions through controlled checkpoints.
5. `05-data-logs.png` - **DATA / LOGS**  
   Indexed history, records, and operational evidence remain searchable.
6. `06-hardware.png` - **HARDWARE**  
   Physical signals, devices, and edge computation meet the digital system.
7. `07-monitoring.png` - **MONITORING**  
   Continuous sensing reveals health, anomalies, and operational change.
8. `08-post-quantum-security.png` - **POST-QUANTUM SECURITY**  
   Quantum-resistant encapsulation protects signals before central routing.
9. `09-protected-connection.png` - **PROTECTED CONNECTION**  
   Braided transport carries encrypted payloads, keys, and verification.

The first eight plates define the system objects: one central core and seven
satellite spheres. The ninth plate is the connection cutaway between a
satellite sphere and the central core.

## How Galaxy models are assembled

Work proceeds in short sprints. Each sprint produces a view available in the [interactive review](../../../prototypes/galaxy-model-review/index.html).

1. **Reference breakdown.** Identify the sphere silhouette, main blocks, small details, and connection entry and exit points. For Hardware, the optical sensor, memory, processor, suspended layers, and cable connector were separate tasks. A single view cannot establish depth and hidden surfaces, so those are defined manually. The original guides are stored in the [Hardware specification](06-hardware.json).
2. **Component sprint.** Build a component from Three.js geometry and open it through **Model → Part**. The [Hardware sensor](../../../prototypes/galaxy-model-review/index.html?service=hardware&part=sensor) and [connector](../../../prototypes/galaxy-model-review/index.html?service=hardware&part=feedthrough) can be inspected separately. The close-up view builds the same component with the same materials and local coordinates. The camera centers the component for inspection.
3. **Connection sprint.** Build routes from port coordinates or existing traces. In Hardware, cool colors flow toward the processor, warm colors flow away from it, and violet marks the lower return route. The [shared signal shader](../../../src/galaxy/js/scene/system-models/signal-packets.js) combines each model's pulses into one mesh. Each pulse has a bright center, a colored envelope, and a fading tail. **Signals** enables motion while the camera stays fixed. PQC uses its own intake, encapsulation, and packet handoff cycle toward Core.
4. **Assembly sprint.** Switch **Part** to **Assembled sphere**. The same functions build all components in a shared coordinate system and batch static outlines and light points. Compare the assembly with the complete reference and check how components read through the shell at 320 and 390 px.
5. **Galaxy assembly.** Open the [complete scene](../../../explore.html) and inspect the seven spheres around Core. Check that components fit their shells, that spheres have clearance, and that connections follow changes in viewing angle.

| Sphere | Components available separately | Signal motion |
| --- | --- | --- |
| Interface / App | Rear, middle, and front panels, metric cards, action button | Along panel, metric, and button traces |
| Backend / API | Sending and receiving racks, gateway channels, traces | Requests and responses use separate gateway channels |
| Automation | Lanes, checkpoints, queued packet, processing node | Along three route lanes |
| Data / Logs | Archive layers, index, scanning plane, data channels | Up five vertical channels |
| Hardware | Processor, suspended layers, memory, controllers, sensor, peripheral node, logic blocks, connector, traces | Seven directed routes between blocks |
| Monitoring | Emitter, cone, wavefronts, telemetry, signal axis | Cyan pulses along the axis, amber in the anomaly region |
| Security / PQC | Intake and outlet, protective bands, encapsulation gateway, protected chamber, packet axis | Packet state changes during protection and handoff to Core |

### Premortem and verification

| Failure mode | Probability | Impact | Detection | Prevention |
| --- | --- | --- | --- | --- |
| A small block disappears after geometry is merged | High | High | Open every component and inspect visible pixels in mobile WebGL | Use the assembly's builder function and select the component before batching |
| A pulse disappears on mobile or crosses the shell | Medium | High | Compare fixed-camera frames and inspect model bounds in orbit | Follow existing traces and check brightness and width at 320 and 390 px |
| Pulses increase draw calls | Medium | High | Compare preview draw calls and triangles | Combine routes into one mesh and update shader uniforms |
| Individual spheres work but overlap or lose connections in Galaxy | Medium | High | Open all seven models in Galaxy at two phases and run `npm run test:galaxy` | Reuse the same builders and shared shell-fitting calculation |
| Signals move when reduced motion is requested | Medium | High | Compare two static-camera frames and test the **Signals** switch separately | Control rotation and pulses independently and use a static default phase |

- [x] All 36 components and seven assemblies rendered in Chromium at mobile widths of 320 and 390 px without horizontal overflow or WebGL errors.
- [x] For each sphere, two moving-signal frames were compared with a fixed camera, followed by two frames with **Signals** disabled. Reduced-motion previews open with static signals.
- [x] Assembled models stay within the geometry budget. All seven spheres loaded in Galaxy at 320, 390, and 1100 px. `npm run test:galaxy` passed 16 checks, including shell fit, orbital clearance, and separate component assembly.
