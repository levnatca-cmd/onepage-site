function updateBrief(current, id, include) {
  if (!Number.isInteger(id) || id < 0 || id >= worlds.length)
    throw new RangeError(`Choose a service from 0 to ${worlds.length - 1}.`);
  const next = new Set(current);
  if (include) next.add(id);
  else next.delete(id);
  return next;
}
function normalizeNotes(value = "") {
  let result = "";
  for (const point of String(value)) {
    const code = point.codePointAt(0);
    const safe = code >= 0xd800 && code <= 0xdfff ? "\ufffd" : point;
    if (result.length + safe.length > 1200) break;
    result += safe;
  }
  return result;
}

function createBriefText(ids, notes = "") {
  const selected = worlds.filter((_, id) => ids.has(id));
  const lines = [
    "Websites, apps & ongoing support",
    "",
    "Services to discuss:",
    ...selected.map((w) => `- ${w.name}: ${w.brief}`),
  ];
  if (!selected.length) lines.push("- I would like help choosing the right scope.");
  const details = normalizeNotes(String(notes).trim());
  if (details) lines.push("", "Project context:", details);
  lines.push("", "Please help me clarify the scope and next steps.");
  return lines.join("\n");
}
function createMailto(ids, notes = "") {
  return `mailto:info@levnat.ca?subject=${encodeURIComponent("Software development & support — project enquiry")}&body=${encodeURIComponent(createBriefText(ids, notes))}`;
}
