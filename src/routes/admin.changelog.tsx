import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, GitBranch, Bug, Sparkles, Wrench } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/changelog")({
  component: ChangelogPage,
});

type ItemType = "feature" | "bug" | "improvement";
type ChangelogItem = { type: ItemType; description: string };
type Release = {
  id: string;
  version: string;
  released_at: string;
  highlight: string | null;
  items: ChangelogItem[];
};

const TYPE_META: Record<ItemType, { label: string; icon: typeof Sparkles; className: string }> = {
  feature: { label: "Novidade", icon: Sparkles, className: "bg-accent/15 text-accent-foreground border-accent/30" },
  bug: { label: "Correção", icon: Bug, className: "bg-destructive/10 text-destructive border-destructive/30" },
  improvement: { label: "Melhoria", icon: Wrench, className: "bg-primary/10 text-primary border-primary/30" },
};

function bumpVersion(v: string, kind: "major" | "minor" | "patch"): string {
  const [maj, min, pat] = v.split(".").map((x) => parseInt(x, 10) || 0);
  if (kind === "major") return `${maj + 1}.0.0`;
  if (kind === "minor") return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

function ChangelogPage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Release | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("app_releases")
      .select("*")
      .order("released_at", { ascending: false });
    if (error) toast.error(error.message);
    setReleases((data as Release[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const latest = releases[0]?.version ?? "1.0.0";

  return (
    <>
      <PageHeader
        title="Versões / Changelog"
        description={`Versão atual: ${latest}`}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Nova versão
          </Button>
        }
      />

      <div className="space-y-4 px-6 pb-10 md:px-8">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : releases.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma versão registrada.</p>
        ) : (
          releases.map((r) => (
            <Card key={r.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <GitBranch className="h-5 w-5 text-primary" /> v{r.version}
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format(new Date(r.released_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                  {r.highlight && (
                    <p className="mt-2 text-sm text-foreground">{r.highlight}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditing(r);
                      setOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm(`Remover versão ${r.version}?`)) return;
                      const { error } = await supabase
                        .from("app_releases")
                        .delete()
                        .eq("id", r.id);
                      if (error) toast.error(error.message);
                      else {
                        toast.success("Versão removida");
                        void load();
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {(r.items ?? []).map((it, idx) => {
                    const meta = TYPE_META[it.type] ?? TYPE_META.improvement;
                    const Icon = meta.icon;
                    return (
                      <li key={idx} className="flex items-start gap-3">
                        <Badge variant="outline" className={`shrink-0 ${meta.className}`}>
                          <Icon className="mr-1 h-3 w-3" /> {meta.label}
                        </Badge>
                        <span className="text-sm text-foreground">{it.description}</span>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <ReleaseDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        latest={latest}
        onSaved={() => {
          setOpen(false);
          void load();
        }}
      />
    </>
  );
}

function ReleaseDialog({
  open,
  onOpenChange,
  editing,
  latest,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Release | null;
  latest: string;
  onSaved: () => void;
}) {
  const [version, setVersion] = useState("");
  const [highlight, setHighlight] = useState("");
  const [items, setItems] = useState<ChangelogItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setVersion(editing.version);
      setHighlight(editing.highlight ?? "");
      setItems(editing.items ?? []);
    } else {
      setVersion(bumpVersion(latest, "patch"));
      setHighlight("");
      setItems([{ type: "improvement", description: "" }]);
    }
  }, [editing, latest, open]);

  const suggestions = useMemo(
    () => ({
      patch: bumpVersion(latest, "patch"),
      minor: bumpVersion(latest, "minor"),
      major: bumpVersion(latest, "major"),
    }),
    [latest],
  );

  const save = async () => {
    const clean = items.filter((i) => i.description.trim());
    if (!version.trim() || clean.length === 0) {
      toast.error("Informe versão e ao menos um item");
      return;
    }
    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from("app_releases")
        .update({ version, highlight: highlight || null, items: clean })
        .eq("id", editing.id);
      if (error) toast.error(error.message);
      else {
        toast.success("Versão atualizada");
        onSaved();
      }
    } else {
      const { error } = await supabase
        .from("app_releases")
        .insert({ version, highlight: highlight || null, items: clean });
      if (error) toast.error(error.message);
      else {
        toast.success(`Versão ${version} publicada`);
        onSaved();
      }
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Editar versão ${editing.version}` : "Nova versão"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Versão</Label>
            <div className="mt-1 flex gap-2">
              <Input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.1"
                className="font-mono"
              />
              {!editing && (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={() => setVersion(suggestions.patch)}>
                    Patch {suggestions.patch}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setVersion(suggestions.minor)}>
                    Minor {suggestions.minor}
                  </Button>
                </>
              )}
            </div>
          </div>

          <div>
            <Label>Resumo (opcional)</Label>
            <Textarea
              value={highlight}
              onChange={(e) => setHighlight(e.target.value)}
              placeholder="Foco da release"
              rows={2}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Itens</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setItems((p) => [...p, { type: "improvement", description: "" }])}
              >
                <Plus className="mr-1 h-3 w-3" /> Adicionar
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="flex gap-2">
                  <Select
                    value={it.type}
                    onValueChange={(v) =>
                      setItems((p) => p.map((x, i) => (i === idx ? { ...x, type: v as ItemType } : x)))
                    }
                  >
                    <SelectTrigger className="w-36 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="feature">Novidade</SelectItem>
                      <SelectItem value="improvement">Melhoria</SelectItem>
                      <SelectItem value="bug">Correção</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={it.description}
                    onChange={(e) =>
                      setItems((p) =>
                        p.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)),
                      )
                    }
                    placeholder="Descrição da mudança"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
