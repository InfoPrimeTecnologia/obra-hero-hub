# Mestre 360 — App Nativo (Capacitor)

O app nativo é um **wrapper** do sistema web: ele carrega `https://app.mestre360.com.br`
dentro de um WebView nativo. Toda atualização publicada no servidor chega ao app
automaticamente, sem resubmissão nas lojas (exceto quando adicionarmos plugins nativos).

## Pré-requisitos (na sua máquina local)

- **Android:** Android Studio + JDK 17
- **iOS:** Mac com Xcode
- **Contas:** Google Play Console (US$ 25, único) e Apple Developer Program (US$ 99/ano)

## Passo a passo

```bash
# 1. Instalar dependências
bun install

# 2. Gerar os projetos nativos (só na primeira vez)
bunx cap add android
bunx cap add ios        # requer Mac

# 3. Sincronizar configuração/plugins
bun run cap:sync

# 4. Abrir nas IDEs para rodar/gerar build
bun run cap:android     # abre no Android Studio
bun run cap:ios         # abre no Xcode (Mac)
```

## Configuração

- `capacitor.config.ts` — appId `br.com.mestre360.app`, URL de produção, splash screen.
- `src/lib/native.ts` — helpers `isNativeApp()` / `getPlatform()` para comportamentos
  específicos do app (ex.: esconder elementos, usar plugins nativos).
- Safe areas (notch): classes utilitárias `pt-safe`, `pb-safe`, `pl-safe`, `pr-safe`
  definidas em `src/styles.css`. A TopBar já usa.

## Ícones e splash screens

Coloque os assets em `resources/` (icon.png 1024x1024, splash.png 2732x2732) e use:

```bash
bunx @capacitor/assets generate
```

## Próximos passos sugeridos

- [ ] Gerar projetos nativos (`cap add`) na máquina local
- [ ] Gerar ícones/splash com a identidade do Mestre 360
- [ ] Testar login e navegação no emulador Android
- [ ] Configurar assinatura de release (keystore Android / certificados iOS)
- [ ] (Opcional) Notificações push via `@capacitor/push-notifications`
