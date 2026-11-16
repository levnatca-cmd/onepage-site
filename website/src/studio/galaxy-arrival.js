import { PLANETS } from "../galaxy/js/data/quiz-data.js";

export function initGalaxyArrival() {
  const html = document.documentElement;
  const service = document.body.dataset.galaxyService;
  const params = new URLSearchParams(location.search);

  if (
    params.get("from") !== "galaxy" ||
    !Object.hasOwn(PLANETS, service) ||
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    performance.getEntriesByType("navigation")[0]?.type === "back_forward"
  ) {
    html.classList.remove("galaxy-arriving");
    return;
  }

  html.classList.add("galaxy-arriving");
  function clearArrival(event) {
    if (
      event.type !== "pagehide" &&
      (event.target !== html || event.animationName !== "galaxy-arrival-reveal")
    )
      return;
    html.classList.remove("galaxy-arriving");
    html.removeEventListener("animationend", clearArrival);
    html.removeEventListener("animationcancel", clearArrival);
    window.removeEventListener("pagehide", clearArrival);
  }
  html.addEventListener("animationend", clearArrival);
  html.addEventListener("animationcancel", clearArrival);
  window.addEventListener("pagehide", clearArrival);
}
