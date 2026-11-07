function makeServiceGeometry(T, w, index) {
  if (!w.model) return new T.SphereGeometry(w.radius, index === 0 ? 64 : 32, index === 0 ? 40 : 24);
  const shape = new T.Shape();
  if (w.model === "phone") {
    shape.moveTo(-0.47, -0.95);
    shape.lineTo(0.47, -0.95);
    shape.quadraticCurveTo(0.6, -0.95, 0.6, -0.82);
    shape.lineTo(0.6, 0.82);
    shape.quadraticCurveTo(0.6, 0.95, 0.47, 0.95);
    shape.lineTo(-0.47, 0.95);
    shape.quadraticCurveTo(-0.6, 0.95, -0.6, 0.82);
    shape.lineTo(-0.6, -0.82);
    shape.quadraticCurveTo(-0.6, -0.95, -0.47, -0.95);
  } else if (w.model === "shield") {
    shape.moveTo(0, 1);
    shape.lineTo(0.86, 0.64);
    shape.lineTo(0.77, -0.25);
    shape.quadraticCurveTo(0.58, -0.75, 0, -1.05);
    shape.quadraticCurveTo(-0.58, -0.75, -0.77, -0.25);
    shape.lineTo(-0.86, 0.64);
    shape.closePath();
  } else throw new RangeError("Unknown service model.");
  const geometry = new T.ExtrudeGeometry(shape, {
    depth: 0.32,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.045,
    bevelThickness: 0.04,
  });
  geometry.center();
  geometry.scale(w.radius, w.radius, w.radius);
  return geometry;
}
