import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Link2, RefreshCw, ExternalLink, Share2 } from "lucide-react";
import { toast } from "sonner";
import { getPortalStatus, togglePortalObra } from "@/lib/portal.functions";

export function PortalClienteCard({ obraId }: { obraId: string }) {
  const getStatus = useServerFn(getPortalStatus);
  const toggle = useServerFn(togglePortalObra);
  const [ativo, setAtivo] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const s = await getStatus({ data: { obraId } });
        setAtivo(Boolean(s?.portal_ativo));
        setToken(s?.portal_token ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, [obraId, getStatus]);

  const url = token && typeof window !== "undefined" ? `${window.location.origin}/portal/${token}` : "";

  const handleToggle = async (next: boolean) => {
    setSaving(true);
    try {
      const res = await toggle({ data: { obraId, ativar: next } });
      setAtivo(Boolean(res?.portal_ativo));
      setToken(res?.portal_token ?? null);
      toast.success(next ? "Portal ativado" : "Portal desativado", {
        description: next ? "Link pronto para compartilhar" : "O link anterior foi invalidado",
      });
    } catch (e: any) {
      toast.error("Não foi possível atualizar o portal", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const handleRotate = async () => {
    setSaving(true);
    try {
      const res = await toggle({ data: { obraId, ativar: true } });
      setToken(res?.portal_token ?? null);
      setAtivo(true);
      toast.success("Novo link gerado", { description: "O link anterior deixou de funcionar" });
    } catch (e: any) {
      toast.error("Erro ao rotacionar link", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="inline-flex items-center gap-2">
            <Share2 className="h-4 w-4 text-primary" /> Portal do cliente
            {ativo && <Badge variant="secondary">ativo</Badge>}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {loading ? "..." : ativo ? "Público" : "Desligado"}
            </span>
            <Switch checked={ativo} disabled={loading || saving} onCheckedChange={handleToggle} />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Compartilhe um link somente-leitura com o cliente exibindo avanço físico, cronograma, últimos RDOs (com fotos) e medições. Sem login.
        </p>
        {ativo && url && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <Input value={url} readOnly className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={copy}>
                <Copy className="mr-2 h-4 w-4" /> Copiar link
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={url} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> Abrir
                </a>
              </Button>
              <Button size="sm" variant="ghost" onClick={handleRotate} disabled={saving}>
                <RefreshCw className="mr-2 h-4 w-4" /> Gerar novo link
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
