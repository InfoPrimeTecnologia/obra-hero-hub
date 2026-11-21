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
    {!open && <button type="button" className="fixed bottom-2 left-2 z-40 rounded px-2 py-1 text-[11px] text-muted-foreground underline hover:text-foreground" onClick={() => { setSettings(true); setOpen(true); }}>Cookies</button>}
    {open && <div ref={panel} tabIndex={-1} role="region" aria-label="Preferências de privacidade" className="fixed bottom-2 left-2 right-2 z-50 mx-auto max-w-xl rounded-md border bg-background p-3 text-foreground shadow-md">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <p className="flex-1 min-w-[180px] text-muted-foreground">Usamos cookies para medir uso e melhorar anúncios. <Link to="/privacidade" className="text-primary underline">Saiba mais</Link></p>
        <Button size="sm" className="h-7 px-3 text-xs" onClick={() => save(true, true)}>Aceitar</Button>
        <Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={() => save(false, false)}>Recusar</Button>
        {!settings && <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setSettings(true)}>Configurar</button>}
      </div>
      {settings && <div className="mt-3 space-y-2 text-xs">
        {gpc && <p>O sinal de privacidade do seu navegador bloqueia a medição opcional.</p>}
        <label className="flex items-center justify-between gap-4">Análise de uso do sistema<Switch aria-label="Análise" checked={analytics} disabled={gpc} onCheckedChange={setAnalytics} /></label>
        <label className="flex items-center justify-between gap-4">Publicidade, fornecida pela Meta<Switch aria-label="Publicidade" checked={advertising} disabled={gpc} onCheckedChange={setAdvertising} /></label>
        <Button size="sm" className="h-7 w-full text-xs" onClick={() => save(analytics, advertising)}>Salvar preferências</Button>
      </div>}
    </div>}
  </>;
}
