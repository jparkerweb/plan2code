// Checks the one browser build the helper downloads.
import { chromium } from "playwright-core";

export const BROWSER = "playwright-core@1.64.1";
// Other versions never count: playwright-core 11.64.10 and 1.64.12 are not the locked one.
export { chromium };
