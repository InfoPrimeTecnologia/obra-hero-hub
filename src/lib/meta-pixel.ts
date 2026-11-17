import { canTrack, readChoice } from "./consent";

export const META_PIXEL_ID = "1757137038715296";
type Pixel = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  push?: Pixel;
  queue: unknown[][];
  loaded: boolean;
  version: string;
};
declare global {
  interface Window { fbq?: Pixel; _fbq?: Pixel; }
}
let initialized = false;
const sent = new Set<string>();

export async function syncMetaPermission() {
  const allowed = await canTrack("advertising");
  if (!allowed) {
    window.fbq?.("consent", "revoke");
    return false;
  }
  // Only public signup pages load the advertising SDK. Never send internal work/financial pages.
  if (!initialized && window.location.pathname !== "/login") return false;
  if (!initialized) {
    if (!window.fbq) {
      const pixel: Pixel = Object.assign(function (...args: unknown[]) {
        if (pixel.callMethod) pixel.callMethod.apply(pixel, args);
        else pixel.queue.push(args);
      }, { queue: [] as unknown[][], loaded: true, version: "2.0" });
      pixel.push = pixel;
      window.fbq = pixel;
      window._fbq = window._fbq || pixel;
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(script);
    }
    window.fbq("set", "autoConfig", false, META_PIXEL_ID);
    window.fbq("init", META_PIXEL_ID, {}, { agent: "lovable" });
    initialized = true;
  }
  window.fbq?.("consent", "grant");
  return true;
}

export async function trackAccountCreated(eventId: string) {
  // Capture permission at success time: later acceptance must not replay a blocked registration.
  if (sent.has(eventId) || !(await syncMetaPermission()) || readChoice("advertising") === "denied") return;
  sent.add(eventId);
  window.fbq?.("trackSingle", META_PIXEL_ID, "CompleteRegistration", {
    status: true,
    content_name: "Cadastro Mestre 360",
    consent_notice: "mestre360-2026-11-17",
    advertising_permission: readChoice("advertising") === "granted" ? "explicit" : "regional_default",
  }, { eventID: eventId });
}