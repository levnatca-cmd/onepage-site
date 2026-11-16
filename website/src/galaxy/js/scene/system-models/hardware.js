import { createHardwareAssembly, batchHardwareFaces } from "./hardware/assembly.js?v=wow60";
import { addHardwareProcessor } from "./hardware/processor.js?v=wow60";
import { addHardwarePeripherals, addHardwareInspectionGuides } from "./hardware/peripherals.js?v=wow60";
import { addHardwareSignalNetwork, createHardwareCable } from "./hardware/signal-network.js?v=wow60";
import { HARDWARE_FEEDTHROUGH_ANCHOR, addHardwareFeedthrough } from "./hardware/feedthrough.js?v=wow60";

export function buildHardwareModel(_color, { THREE, part }) {
  const assembly = createHardwareAssembly(THREE);
  const { root, holo } = assembly;
  const anchor = new THREE.Vector3(...HARDWARE_FEEDTHROUGH_ANCHOR);

  const processorPorts = addHardwareProcessor(assembly, part);
  const peripheralPorts = addHardwarePeripherals(assembly, part);
  const cable = createHardwareCable(assembly);
  if (!part || part === "routes") addHardwareSignalNetwork(assembly, processorPorts, peripheralPorts, anchor, cable);
  if (!part) addHardwareInspectionGuides(assembly);
  const mount = !part || part === "feedthrough"
    ? addHardwareFeedthrough(assembly, anchor, cable, Boolean(part))
    : null;

  batchHardwareFaces(root, THREE);
  if (mount) batchHardwareFaces(mount, THREE);
  holo.finish();

  return { root, mechanicalParts: [], semanticRole: "hardware" };
}
