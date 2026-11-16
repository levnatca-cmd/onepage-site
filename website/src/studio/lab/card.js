import { LAB_THEMES, publicLabConfig } from "./state.js";

export function createBuildCard(state) {
  const config = publicLabConfig(state);
  const canvas = document.createElement("canvas");
  canvas.width = 1440;
  canvas.height = 960;
  const ctx = canvas.getContext("2d");
  const accent = LAB_THEMES[config.theme].color;
  const text = (value, x, y, size, color = "#171a1e", weight = 600) => {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px Manrope, Arial, sans-serif`;
    ctx.fillText(value, x, y);
  };
  const rect = (x, y, width, height, color, radius = 8) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
  };
  ctx.fillStyle = "#edf0f3";
  ctx.fillRect(0, 0, 1440, 960);
  rect(64, 60, 52, 52, accent, 0);
  text("L.", 73, 97, 32);
  text("LEVNAT / A SYSTEM YOU BUILT", 136, 96, 24);
  text("One idea.", 64, 246, 94);
  text("A working system.", 64, 356, 94);
  const fault = config.fault !== "none";
  const points = [
    [260, 560],
    [720, 560],
    [1180, 560],
  ];
  ctx.lineWidth = 10;
  for (let i = 0; i < 2; i++) {
    const interrupted = config.fault === (i === 0 ? "api" : "device");
    ctx.strokeStyle = interrupted
      ? "#ed735a"
      : config.api === "1" && (i === 0 || !fault)
        ? accent
        : "#c6ccd2";
    ctx.beginPath();
    ctx.moveTo(points[i][0], 560);
    ctx.lineTo(points[i + 1][0], 560);
    ctx.stroke();
  }
  ["APPLICATION", "API ROUTE", "DELIVERY"].forEach((label, i) => {
    const [x, y] = points[i];
    rect(x - 150, y - 100, 300, 200, "#171a1e", 12);
    rect(
      x - 128,
      y - 78,
      256,
      12,
      (i === 0 && config.built === "1") ||
        (i === 1 && config.api === "1" && config.fault !== "api") ||
        (i === 2 && config.api === "1" && !fault)
        ? accent
        : fault && ((i === 1 && config.fault === "api") || (i === 2 && config.fault === "device"))
          ? "#ed735a"
          : "#66717d",
      2,
    );
    text(`0${i + 1}`, x - 126, y + 2, 42, "#f8f9fa");
    text(label, x - 126, y + 62, 19, "#cbd1d8");
  });
  const stateLabel =
    config.built === "0"
      ? "READY TO BUILD"
      : fault
        ? config.fault === "api"
          ? "API TIMEOUT / SAFE QUEUE"
          : "DEVICE OFFLINE / SAFE QUEUE"
        : config.api === "1"
          ? "CONNECTED / READY"
          : "APP BUILT / API OFFLINE";
  text(stateLabel, 64, 780, 28);
  ctx.strokeStyle = "#c9d0d5";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(64, 838);
  ctx.lineTo(1376, 838);
  ctx.stroke();
  text("Independent local prototype. Public configuration only.", 64, 889, 20, "#59636c", 400);
  text("levnat.ca", 1200, 889, 25);
  return canvas;
}
