// Service previews share the same selection and brief state as the scene.
function makeHolograms({ panel, toggle, status, services, onDetails, onScope, inBrief }) {
  const find = (id) => panel.querySelector(`#${id}`);
  const closeButton = find("hologram-close");
  const scopeButton = find("hologram-scope");
  let activeId = null;
  let opener = null;

  function syncBrief() {
    if (activeId === null) return;
    const included = inBrief(activeId);
    scopeButton.textContent = included ? "Remove from brief −" : "Add to brief +";
    scopeButton.setAttribute("aria-pressed", String(included));
  }

  function open(id, { focus = false } = {}) {
    if (!Number.isInteger(id) || id < 0 || id >= services.length) return;
    if (!panel.contains(document.activeElement)) opener = document.activeElement;
    const service = services[id];
    activeId = id;
    find("hologram-path").textContent = service.type;
    find("hologram-title").textContent = service.name;
    find("hologram-description").textContent = service.info;
    find("hologram-modules").replaceChildren(
      ...service.deliverables.map((text) => {
        const item = document.createElement("li");
        item.textContent = text;
        return item;
      }),
    );
    panel.hidden = false;
    panel.closest(".map-stage").classList.add("holograms-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.textContent = "Close preview";
    status.textContent = `${service.name} preview opened. Press Escape to close.`;
    syncBrief();
    if (focus) closeButton.focus({ preventScroll: true });
  }

  function close() {
    if (panel.hidden) return;
    const restoreFocus = panel.contains(document.activeElement);
    panel.hidden = true;
    panel.closest(".map-stage").classList.remove("holograms-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "View selection";
    status.textContent = "Service preview closed.";
    if (restoreFocus)
      (opener?.isConnected && !opener.closest("[hidden]") ? opener : toggle).focus();
  }

  closeButton.addEventListener("click", close);
  find("hologram-details").addEventListener("click", () => onDetails(activeId));
  scopeButton.addEventListener("click", () => onScope(activeId));
  return { open, close, syncBrief, isOpen: () => !panel.hidden };
}
