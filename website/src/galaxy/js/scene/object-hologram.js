const EDGE_GAP = 12;
const CONTROL_CLEARANCE = 62;
const PANEL_HEIGHT = 54;
const LABEL_GUTTER = 30;
const MIN_PANEL_WIDTH = 72;
const PROJECTION_WIDTH = 100;
const REVEAL_ORIGINS = {
  right: "0 50%",
  left: "100% 50%",
  below: "50% 0",
  above: "50% 100%",
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createObjectHologram(stage) {
  const overlay = document.createElement("div");
  overlay.className = "galaxy-object-hologram";
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");

  const projection = document.createElement("div");
  projection.className = "galaxy-object-hologram-projection";
  projection.style.width = PROJECTION_WIDTH + "px";
  const panel = document.createElement("div");
  panel.className = "galaxy-object-hologram-panel";
  panel.style.height = PANEL_HEIGHT + "px";
  overlay.append(projection, panel);
  stage.append(overlay);
  const textMeasure = document.createElement("canvas").getContext("2d");

  let activeLabel = null;
  let activeColor = null;
  let labelWidth = 0;
  let placement = null;
  let lastWidth = 0;

  function show(label, color) {
    if (activeLabel === label && activeColor === color) return;
    activeLabel = label;
    activeColor = color;
    placement = null;
    overlay.style.setProperty("--hologram-accent", color);
    if (textMeasure) textMeasure.font = '650 12px "Oxanium", system-ui, sans-serif';
    labelWidth = Math.ceil(textMeasure?.measureText(label).width ?? label.length * 6.5);

    const text = document.createElement("div");
    text.className = "galaxy-object-hologram-label";
    text.textContent = label;
    panel.replaceChildren(text);
  }

  function hide() {
    activeLabel = null;
    overlay.hidden = true;
  }

  function update(x, y, radius, width, height) {
    if (!activeLabel) return;
    const minTop = CONTROL_CLEARANCE;
    const maxTop = height - CONTROL_CLEARANCE - PANEL_HEIGHT;
    if (
      !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) ||
      !Number.isFinite(width) || !Number.isFinite(height) ||
      x < 0 || x > width || y < 0 || y > height ||
      width <= EDGE_GAP * 2 || maxTop < minTop
    ) {
      overlay.hidden = true;
      return;
    }

    const compact = width < 540;
    const panelWidth = Math.min(
      width - EDGE_GAP * 2,
      compact ? 144 : 176,
      Math.max(MIN_PANEL_WIDTH, labelWidth + LABEL_GUTTER),
    );
    const maxLeft = width - EDGE_GAP - panelWidth;
    const reach = Math.max(0, radius) + (compact ? 14 : 20);
    const right = x + reach;
    const left = x - reach - panelWidth;
    const below = y + reach;
    const above = y - reach - PANEL_HEIGHT;
    const fits = {
      right: right <= maxLeft,
      left: left >= EDGE_GAP,
      below: below <= maxTop,
      above: above >= minTop,
    };

    const outward = x < width / 2 ? "left" : "right";
    const inward = outward === "left" ? "right" : "left";
    const nearCenter = Math.abs(x - width / 2) < 18;
    const vertical = y < height / 2 ? "above" : "below";
    const oppositeVertical = vertical === "above" ? "below" : "above";
    const currentVerticalFits = (placement === "above" || placement === "below") && fits[placement];
    const nextPlacement =
      (!nearCenter && fits[outward] && outward) ||
      (currentVerticalFits && placement) ||
      (fits[vertical] && vertical) ||
      (fits[oppositeVertical] && oppositeVertical) ||
      (fits[outward] && outward) ||
      (fits[inward] && inward) ||
      vertical;
    if (placement !== nextPlacement) {
      placement = nextPlacement;
      panel.style.setProperty("--hologram-reveal-origin", REVEAL_ORIGINS[placement]);
    }
    if (panelWidth !== lastWidth) {
      panel.style.width = panelWidth + "px";
      lastWidth = panelWidth;
    }

    const panelX = clamp(
      placement === "left" ? left : placement === "right" ? right : x - panelWidth / 2,
      EDGE_GAP,
      maxLeft,
    );
    const panelY = clamp(
      placement === "above" ? above : placement === "below" ? below : y - PANEL_HEIGHT / 2,
      minTop,
      maxTop,
    );
    panel.style.transform = `translate3d(${panelX}px, ${panelY}px, 0)`;

    const dx = clamp(x, panelX, panelX + panelWidth) - x;
    const dy = clamp(y, panelY, panelY + PANEL_HEIGHT) - y;
    const distance = Math.hypot(dx, dy);
    const fromCenter = Math.min(Math.max(0, radius), distance);
    const surface = distance > 0 ? fromCenter / distance : 0;
    const startX = x + dx * surface;
    const startY = y + dy * surface;
    const stretch = (distance - fromCenter) / PROJECTION_WIDTH;
    projection.style.transform =
      `translate3d(${startX}px, ${startY}px, 0) rotate(${Math.atan2(dy, dx)}rad) scaleX(${stretch})`;
    overlay.hidden = false;
  }

  return { show, hide, update };
}
