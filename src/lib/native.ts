import { Capacitor } from "@capacitor/core";

/** true quando rodando dentro do app nativo (Android/iOS via Capacitor). */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** "android" | "ios" | "web" */
export function getPlatform(): string {
  try {
    return Capacitor.getPlatform();
  } catch {
    return "web";
  }
}
