import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Camera,
  Send,
  Trash2,
  Mail,
  MessageCircle,
  ArrowLeft,
  Image as ImageIcon,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/app/obras/$obraId/diario")({
  component: DiarioPage,
});

type Obra = {
  id: string;
  customer_id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_whatsapp: string | null;
};

type Diario = {
  id: string;
  diary_date: string;
  weather: string | null;
  activities: string | null;
  workforce: string | null;
  notes: string | null;
  created_at: string;
};

type Foto = {
  id: string;
  storage_path: string;
  caption: string | null;
  diario_id: string;
  url?: string;
};

function DiarioPage() {
  const { obraId } = Route.useParams();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [obra, setObra] = useState<Obra | null>(null);
  const [diarios, setDiarios] = useState<Diario[]>([]);
  const [fotos, setFotos] = useState<Record<string, Foto[]>>({});
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [weather, setWeather] = useState("");
  const [activities, setActivities] = useState("");
  const [workforce, setWorkforce] = useState("");
  const [notes, setNotes] = useState("");

  const carregar = async () => {
    const { data: o } = await supabase
      .from("obras")
      .select(
        "id,customer_id,name,contact_name,contact_email,contact_whatsapp",
      )
      .eq("id", obraId)
      .maybeSingle();
    setObra(o as Obra | null);

    const { data: ds } = await supabase
      .from("obra_diarios")
      .select("id,diary_date,weather,activities,workforce,notes,created_at")
      .eq("obra_id", obraId)
      .order("diary_date", { ascending: false })
      .limit(30);
    const lista = (ds ?? []) as Diario[];
    setDiarios(lista);

    if (lista.length) {
      const { data: fs } = await supabase
        .from("obra_diario_fotos")
        .select("id,storage_path,caption,diario_id")
        .in(
          "diario_id",
          lista.map((d) => d.id),
        );
      const map: Record<string, Foto[]> = {};
      for (const f of (fs ?? []) as Foto[]) {
        const { data: signed } = await supabase.storage
          .from("obra-fotos")
          .createSignedUrl(f.storage_path, 3600);
        map[f.diario_id] = map[f.diario_id] ?? [];
        map[f.diario_id].push({ ...f, url: signed?.signedUrl });
      }
      setFotos(map);
    } else {
      setFotos({});
    }
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId]);

  const novoDiario = async (e: FormEvent) => {
    e.preventDefault();
    if (!obra) return;
    setSaving(true);
    const { data: created, error } = await supabase
      .from("obra_diarios")
      .insert({
        obra_id: obra.id,
        customer_id: obra.customer_id,
        diary_date: date,
        weather: weather || null,
        activities: activities || null,
        workforce: workforce || null,
        notes: notes || null,
        created_by: user!.id,
      })
      .select("id")
      .maybeSingle();
    setSaving(false);
    if (error) {
      toast.error("Erro ao criar diário", { description: error.message });
      return;
    }
    toast.success("Diário criado!");
    setWeather("");
    setActivities("");
    setWorkforce("");
    setNotes("");
    if (created && fileRef.current?.files?.length) {
      await uploadFotos(created.id, fileRef.current.files);
      fileRef.current.value = "";
    }
    void carregar();
  };

  const uploadFotos = async (diarioId: string, files: FileList) => {
    if (!obra) return;
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${obra.customer_id}/${obra.id}/${diarioId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("obra-fotos").upload(path, file);
      if (upErr) {
        toast.error("Falha ao enviar foto", { description: upErr.message });
        continue;
      }
      const { error: dbErr } = await supabase.from("obra_diario_fotos").insert({
        diario_id: diarioId,
        obra_id: obra.id,
        customer_id: obra.customer_id,
        storage_path: path,
        created_by: user!.id,
      });
      if (dbErr) toast.error("Falha ao registrar foto", { description: dbErr.message });
    }
  };

  const adicionarFotosExistente = async (
    diarioId: string,
    files: FileList | null,
  ) => {
    if (!files?.length) return;
    await uploadFotos(diarioId, files);
    toast.success("Fotos enviadas");
    void carregar();
  };

  const excluirFoto = async (foto: Foto) => {
    await supabase.storage.from("obra-fotos").remove([foto.storage_path]);
    await supabase.from("obra_diario_fotos").delete().eq("id", foto.id);
    void carregar();
  };

  const montarRelatorio = (d: Diario) => {
    const fotosCount = fotos[d.id]?.length ?? 0;
    return [
      `*Diário da Obra: ${obra?.name ?? ""}*`,
      `Data: ${new Date(d.diary_date).toLocaleDateString("pt-BR")}`,
      d.weather ? `Clima: ${d.weather}` : null,
      d.workforce ? `Mão de obra: ${d.workforce}` : null,
      d.activities ? `\nAtividades:\n${d.activities}` : null,
      d.notes ? `\nObservações:\n${d.notes}` : null,
      fotosCount ? `\n${fotosCount} foto(s) anexada(s).` : null,
      `\n— Enviado via Mestre 360`,
    ]
      .filter(Boolean)
      .join("\n");
  };

  const enviarWhatsApp = (d: Diario) => {
    if (!obra?.contact_whatsapp) {
      toast.error("Cadastre o WhatsApp do contato da obra primeiro.");
      return;
    }
    const tel = obra.contact_whatsapp.replace(/\D/g, "");
    const url = `https://wa.me/${tel}?text=${encodeURIComponent(montarRelatorio(d))}`;
    window.open(url, "_blank");
  };

  const enviarEmail = (d: Diario) => {
    if (!obra?.contact_email) {
      toast.error("Cadastre o e-mail do contato da obra primeiro.");
      return;
    }
    const subject = `Diário da Obra ${obra.name} - ${new Date(d.diary_date).toLocaleDateString("pt-BR")}`;
    const body = montarRelatorio(d);
    window.location.href = `mailto:${obra.contact_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div>
      <PageHeader
        title={obra ? `Diário — ${obra.name}` : "Diário da obra"}
        description={
          obra?.contact_name
            ? `Contato: ${obra.contact_name}${obra.contact_whatsapp ? " • " + obra.contact_whatsapp : ""}`
            : "Registre as atividades diárias e envie o relatório"
        }
        actions={
          <Button variant="outline" asChild>
            <Link to="/app/obras">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Link>
          </Button>
        }
      />
      <div className="space-y-6 p-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Novo registro</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={novoDiario} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Clima</Label>
                  <Input
                    value={weather}
                    onChange={(e) => setWeather(e.target.value)}
                    placeholder="Ensolarado, chuvoso..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mão de obra</Label>
                  <Input
                    value={workforce}
                    onChange={(e) => setWorkforce(e.target.value)}
                    placeholder="12 pedreiros, 4 ajudantes..."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Atividades realizadas</Label>
                <Textarea
                  rows={3}
                  value={activities}
                  onChange={(e) => setActivities(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fotos</Label>
                <Input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                />
                <p className="text-xs text-muted-foreground">
                  No celular, abre a câmera. No desktop, selecione arquivos.
                </p>
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar diário"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Histórico</h2>
          {diarios.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Nenhum diário ainda.
              </CardContent>
            </Card>
          ) : (
            diarios.map((d) => (
              <Card key={d.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle className="text-base">
                      {new Date(d.diary_date).toLocaleDateString("pt-BR")}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {d.weather ?? "—"} {d.workforce ? ` • ${d.workforce}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => enviarWhatsApp(d)}>
                      <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => enviarEmail(d)}>
                      <Mail className="mr-2 h-4 w-4" /> E-mail
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        enviarWhatsApp(d);
                        enviarEmail(d);
                      }}
                    >
                      <Send className="mr-2 h-4 w-4" /> Ambos
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {d.activities && (
                    <div>
                      <p className="font-medium">Atividades</p>
                      <p className="whitespace-pre-line text-muted-foreground">{d.activities}</p>
                    </div>
                  )}
                  {d.notes && (
                    <div>
                      <p className="font-medium">Observações</p>
                      <p className="whitespace-pre-line text-muted-foreground">{d.notes}</p>
                    </div>
                  )}

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-medium">
                        Fotos ({fotos[d.id]?.length ?? 0})
                      </p>
                      <label className="cursor-pointer text-xs text-primary hover:underline">
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            void adicionarFotosExistente(d.id, e.target.files);
                            e.target.value = "";
                          }}
                        />
                        <Camera className="mr-1 inline h-3 w-3" /> Adicionar foto
                      </label>
                    </div>
                    {fotos[d.id]?.length ? (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {fotos[d.id].map((f) => (
                          <div key={f.id} className="group relative">
                            {f.url ? (
                              <img
                                src={f.url}
                                alt={f.caption ?? "Foto da obra"}
                                className="h-28 w-full rounded-md object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-28 w-full items-center justify-center rounded-md bg-muted">
                                <ImageIcon className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            <button
                              onClick={() => void excluirFoto(f)}
                              className="absolute right-1 top-1 rounded bg-background/80 p-1 opacity-0 transition group-hover:opacity-100"
                              aria-label="Excluir foto"
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhuma foto.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
