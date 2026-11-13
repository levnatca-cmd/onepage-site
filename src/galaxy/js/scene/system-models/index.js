import { buildWebModel } from "./web.js?v=wow60";
import { buildBackendModel } from "./backend.js?v=wow60";
import { buildAutomationModel } from "./automation.js?v=wow60";
import { buildPqcModel } from "./pqc.js?v=wow60";
import { buildDataModel } from "./data.js?v=wow60";
import { buildHardwareModel } from "./hardware.js?v=wow60";
import { buildMonitoringModel } from "./monitoring.js?v=wow60";

export const SYSTEM_MODEL_BUILDERS = Object.freeze({
  firmware: buildWebModel,
  backend: buildBackendModel,
  automation: buildAutomationModel,
  pqc: buildPqcModel,
  data: buildDataModel,
  hardware: buildHardwareModel,
  ops: buildMonitoringModel
});

export function buildSystemModel(id, color, kit) {
  const builder = SYSTEM_MODEL_BUILDERS[id];
  if (!builder) throw new Error("Unknown semantic system model: " + id);
  const result = builder(color, kit);
  if (!result || !result.root) throw new Error("Invalid semantic system model: " + id);
  return result;
}
