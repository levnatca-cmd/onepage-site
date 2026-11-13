import { DAYBOOK_DEMO_PATH, isLegacyDaybookLocation } from "./start-route.js";

const { location } = window;
if (isLegacyDaybookLocation(location)) {
  location.replace(DAYBOOK_DEMO_PATH + location.search + location.hash);
}
