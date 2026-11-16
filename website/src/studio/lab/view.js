const icon = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;

export function systemWorkbench() {
  return `<div class="system-workbench" data-system-lab id="system-workbench"><span id="live-system" class="lab-anchor" aria-hidden="true"></span>
    <div class="lab-bar"><div class="lab-brand"><span class="lab-brand-mark" aria-hidden="true">d.</span><strong>daybook<span>Independent product demo</span></strong></div><div class="lab-tools">
      <button type="button" class="icon-button" data-lab-reset aria-label="Reset demo" title="Reset demo" disabled>${icon("rotate-ccw")}</button>
      <button type="button" class="icon-button" data-lab-share aria-label="Copy this setup" title="Copy this setup" disabled>${icon("link")}</button>
      <button type="button" class="icon-button" data-lab-download aria-label="Save build card" title="Save build card" disabled>${icon("download")}</button>
    </div></div>
    <div class="lab-product" data-lab-product>
      <div class="lab-product-heading"><span class="lab-product-label">A small idea.<br>A working product.</span><span class="lab-live-badge" data-lab-health>Not built</span></div>
      <form id="lab-booking-form" class="lab-booking-form">
        <fieldset disabled><legend>Reserve a sample session</legend>
          <div class="lab-slot-list" role="group" aria-label="Available session times">${["09:00", "11:00", "14:00"].map((slot, i) => `<button type="button" data-lab-slot="${slot}" aria-pressed="${i === 0}">${slot}</button>`).join("")}</div>
          <div class="lab-booking-fields"><div><label for="lab-guest">Sample name</label><input id="lab-guest" name="guest" value="Sample guest" minlength="2" maxlength="40" required autocomplete="off"></div><button class="button" type="submit" data-lab-submit>Book session ${icon("arrow-up-right")}</button></div>
        </fieldset>
      </form>
      <div class="lab-build-cover" data-lab-build-cover aria-hidden="true"><span class="lab-wireframe"><span></span><span></span><span></span></span><span>Interface / API / delivery</span></div>
    </div>
    <div class="lab-mode-panel"><div class="lab-mode-info"><span class="lab-step" data-lab-step>01 / Build</span><strong data-lab-action-title>Turn the idea into an app.</strong></div><div class="lab-mode-action"><label class="sr-only" for="lab-fault-type">Simulated fault</label><select id="lab-fault-type" hidden><option value="api">API timeout</option><option value="device">Device offline</option></select><button type="button" class="button primary" data-lab-action disabled>Build app ${icon("plus")}</button></div></div>
    <div class="lab-bottom"><div class="lab-counters" aria-label="Local sample request counts"><span><b data-lab-count="requests">0</b>requests</span><span><b data-lab-count="pending">0</b>pending</span><span><b data-lab-count="delivered">0</b>delivered</span></div><div class="lab-swatches" role="group" aria-label="Product accent"><button type="button" data-lab-theme="cobalt" aria-label="Cobalt accent" title="Cobalt accent" aria-pressed="true" style="--swatch:#4261f2" disabled></button><button type="button" data-lab-theme="citrus" aria-label="Citrus accent" title="Citrus accent" aria-pressed="false" style="--swatch:#c4f563" disabled></button><button type="button" data-lab-theme="rose" aria-label="Rose accent" title="Rose accent" aria-pressed="false" style="--swatch:#efbdd6" disabled></button></div></div>
    <div class="lab-status-row"><p class="lab-toast" id="lab-status" role="status">Local sample data. No booking or message is sent.</p><button type="button" class="lab-inspect-button" data-lab-inspect aria-expanded="false" aria-controls="lab-inspection" hidden>Inspect event ${icon("arrow-down-right")}</button></div>
    <div class="lab-inspection" id="lab-inspection" hidden><div class="lab-inspection-heading"><strong>Live event trail</strong><span>Local sample</span></div><ol data-lab-inspection-events></ol><a href="#ledger-heading">Full request workspace ${icon("arrow-down")}</a></div>
    <label class="lab-share-fallback" hidden>Public setup link<input id="lab-share-link" readonly></label>
    <noscript><p>This independent prototype needs JavaScript. <a href="/work/daybook/">Read the project</a> or <a href="/contact/">discuss your project</a>.</p></noscript>
  </div>`;
}

export function systemLedger() {
  return `<section class="system-ledger" aria-labelledby="ledger-heading"><div class="ledger-grid container">
    <div class="ledger-intro"><p class="eyebrow">Behind the interface</p><h2 id="ledger-heading">Every action<br>leaves a trace.</h2><p>One local prototype, from a booking request to delivery. No production API or physical device is connected.</p><a class="text-link" href="/work/daybook/">Inside the build ${icon("arrow-up-right")}</a></div>
    <div class="ledger-workspace"><div class="lab-topology" aria-label="Sample system status"><div data-lab-node="app" data-status="idle">${icon("app-window")}<span>Application</span><b>Not built</b></div><span class="topology-connector" aria-hidden="true"></span><div data-lab-node="api" data-status="idle">${icon("workflow")}<span>API route</span><b>Disconnected</b></div><span class="topology-connector" aria-hidden="true"></span><div data-lab-node="device" data-status="idle">${icon("radio")}<span>Delivery</span><b>Standby</b></div></div>
      <div class="lab-ledger-columns"><div><h3>Request workspace <span data-lab-queue-label>0 records</span></h3><ul class="lab-deliveries" data-lab-records aria-label="Sample requests"><li class="lab-empty">No sample requests yet.</li></ul></div><div><h3>Event trail <span>Local events</span></h3><ol class="lab-events" data-lab-events aria-label="System events"><li class="lab-empty">The system is waiting.</li></ol></div></div>
    </div>
  </div></section>`;
}
