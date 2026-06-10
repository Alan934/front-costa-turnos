import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

/** Worker de MSW para el navegador (desarrollo contra mocks). */
export const worker = setupWorker(...handlers);
