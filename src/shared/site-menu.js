for (const toggle of document.querySelectorAll("[data-site-menu-toggle]")) {
  const menu = document.getElementById(toggle.getAttribute("aria-controls"));
  const header = toggle.closest("header");
  if (!menu || !header) continue;

  function setOpen(open) {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.classList.toggle("is-open", open);
  }

  toggle.addEventListener("click", () => {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape" || toggle.getAttribute("aria-expanded") !== "true") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
      toggle.focus();
    },
    true,
  );

  document.addEventListener("click", (event) => {
    if (!header.contains(event.target) || menu.contains(event.target.closest?.("a"))) {
      setOpen(false);
    }
  });

  const compact = matchMedia(`(max-width: ${toggle.dataset.siteMenuToggle}px)`);
  compact.addEventListener?.("change", (event) => {
    if (!event.matches) setOpen(false);
  });
  header.classList.add("has-site-menu");
}
