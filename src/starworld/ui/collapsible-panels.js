// Disclosures keep hidden controls out of keyboard navigation without altering scene state.
function makeCollapsiblePanel({ container, closeButton, content, triggers = [], fallbackFocus }) {
  let opener = null;

  function setOpen(open) {
    if (open && container.hidden) opener = document.activeElement;
    const restoreFocus = !open && container.contains(document.activeElement);
    content.hidden = !open;
    container.hidden = !open;
    for (const trigger of triggers) trigger.setAttribute("aria-expanded", String(open));
    if (restoreFocus) (opener?.getClientRects().length ? opener : fallbackFocus).focus();
  }
  closeButton.addEventListener("click", () => setOpen(false));
  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
    isOpen: () => !content.hidden,
  };
}
