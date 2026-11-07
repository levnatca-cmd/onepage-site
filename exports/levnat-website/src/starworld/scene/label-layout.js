function placeMapLabel(anchor, size, bounds, obstacles) {
  const pad = 8;
  if (size.width > bounds.width - pad * 2 || size.height > bounds.height - pad * 2) return null;
  const candidates = [
    [anchor.x - size.width / 2, anchor.y],
    [anchor.x - size.width / 2, anchor.y - size.height - 18],
    [anchor.x + 16, anchor.y - size.height / 2],
    [anchor.x - size.width - 16, anchor.y - size.height / 2],
  ];
  for (const [x, y] of candidates) {
    const box = {
      x: Math.max(pad, Math.min(bounds.width - size.width - pad, x)),
      y: Math.max(pad, Math.min(bounds.height - size.height - pad, y)),
      width: size.width,
      height: size.height,
    };
    if (
      !obstacles.some(
        (o) =>
          box.x < o.x + o.width + 6 &&
          box.x + box.width + 6 > o.x &&
          box.y < o.y + o.height + 6 &&
          box.y + box.height + 6 > o.y,
      )
    )
      return box;
  }
  return null;
}
