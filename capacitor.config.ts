import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Mestre 360 — app nativo (Capacitor).
 *
 * O sistema é SSR/full-stack, então o app nativo carrega a URL de produção
 * em vez de empacotar assets estáticos. Isso significa:
 *  - Toda atualização publicada no servidor web chega ao app automaticamente
 *    (sem resubmissão na loja para mudanças de UI/lógica).
 *  - O app exige conexão com a internet para funcionar.
 *
 * Comandos (na sua máquina local, com Android Studio / Xcode instalados):
 *  bunx cap sync        # sincroniza config com os projetos nativos
 *  bunx cap open android  # abre no Android Studio
 *  bunx cap open ios      # abre no Xcode (requer Mac)
 */
const config: CapacitorConfig = {
  appId: "br.com.mestre360.app",
  appName: "Mestre 360",
  webDir: "dist/client",
  server: {
    url: "https://app.mestre360.com.br",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: "automatic",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#0F172A",
      showSpinner: false,
    },
  },
};

export default config;
