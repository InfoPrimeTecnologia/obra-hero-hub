import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { needsAnswer, onConsentChange, readChoice, saveChoices } from "@/lib/consent";
import { syncMetaPermission } from "@/lib/meta-pixel";

export function PrivacyConsent() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [advertising, setAdvertising] = useState(false);
  const [gpc, setGpc] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let live = true;
    const refresh = () => {
      setAnalytics(readChoice("analytics") === "granted");
      setAdvertising(readChoice("advertising") === "granted");
      setGpc((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true);
      void syncMetaPermission();
    };
    refresh();
    void needsAnswer(["analytics", "advertising"]).then(value => { if (live) setOpen(value); });
    const unsubscribe = onConsentChange(refresh);
    return () => { live = false; unsubscribe(); };
  }, []);
  useEffect(() => { if (open) panel.current?.focus(); }, [open]);
  const save = (a: boolean, b: boolean) => {
    saveChoices({ analytics: a ? "granted" : "denied", advertising: b ? "granted" : "denied" });
    // Notice version accompanies the module's timestamped per-purpose answers.
    try { localStorage.setItem("mestre360.consent_notice", "mestre360-2026-11-17"); } catch { /* unavailable storage */ }
    setOpen(false);
    setSettings(false);
  };
  return <>
    <Button variant="outline" size="sm" className="fixed bottom-3 left-3 z-40" onClick={() => { setSettings(true); setOpen(true); }}>Privacidade e cookies</Button>
    {open && <div ref={panel} tabIndex={-1} role="region" aria-label="Preferências de privacidade" className="fixed bottom-14 left-3 right-3 z-50 max-w-lg rounded-lg border bg-background p-5 text-foreground shadow-lg">
      <h2 className="font-semibold">Sua privacidade</h2>
      <p className="mt-2 text-sm text-muted-foreground">Contamos visitas sem cookies. Se aceitar, também medimos cliques. Cookies de publicidade registram cadastros para melhorar anúncios no Facebook e Instagram.</p>
      <Link to="/privacidade" className="mt-2 inline-block text-sm text-primary underline">Política de privacidade</Link>
      {settings && <div className="my-4 space-y-3 text-sm">
        <div>Necessários — sempre ativos</div>
        {gpc && <p>O sinal de privacidade do seu navegador bloqueia a medição opcional.</p>}
        <label className="flex items-center justify-between gap-4">Análise, fornecida pela Lovable<Switch aria-label="Análise" checked={analytics} disabled={gpc} onCheckedChange={setAnalytics} /></label>
        <label className="flex items-center justify-between gap-4">Publicidade, fornecida pela Meta<Switch aria-label="Publicidade" checked={advertising} disabled={gpc} onCheckedChange={setAdvertising} /></label>
        <Button className="w-full" onClick={() => save(analytics, advertising)}>Salvar preferências</Button>
      </div>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => save(true, true)}>Aceitar todos</Button>
        <Button variant="outline" onClick={() => save(false, false)}>Recusar todos</Button>
      </div>
      <Button variant="link" className="mt-2" onClick={() => setSettings(true)}>Configurar cookies</Button>
    </div>}
  </>;
}