import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Camera,
  Trash2,
  Save,
  Users,
  Activity,
  AlertTriangle,
  Image as ImageIcon,
  Mail,
  MessageCircle,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { usePlanModules } from "@/lib/use-plan-modules";
import { toast } from "sonner";

export const Route = createFileRoute("/app/obras/$obraId/rdo/$rdoId")({
  component: RdoDetailPage,
});

type Obra = {
  id: string;
  customer_id: string;
  name: string;
  contact_email: string | null;
  contact_whatsapp: string | null;
};
type Rdo = {
  id: string;
  obra_id: string;
  customer_id: string;
  data: string;
  clima_manha: string | null;
  clima_tarde: string | null;
  clima_noite: string | null;
  condicao: string;
  responsavel: string | null;
  observacoes: string | null;
};
type Equipe = {
  id: string;
  empreiteiro: string | null;
  funcao: string;
  quantidade: number;
  horas: number;
};
type Etapa = { id: string; nome: string };
type Subetapa = { id: string; nome: string; etapa_id: string };
type Atividade = {
  id: string;
  etapa_id: string | null;
  subetapa_id: string | null;
  descricao: string;
  percentual: number;
};
type Ocorrencia = { id: string; tipo: string; descricao: string };
type Anexo = {
  id: string;
  storage_path: string;
  legenda: string | null;
  tipo: string;
  url?: string;
};

function RdoDetailPage() {
  const { obraId, rdoId } = Route.useParams();
  const { user } = useAuth();
  const { hasFeature } = usePlanModules();

  const [obra, setObra] = useState<Obra | null>(null);
  const [rdo, setRdo] = useState<Rdo | null>(null);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [subetapas, setSubetapas] = useState<Subetapa[]>([]);

  // form state — equipe
  const [eqEmpreiteiro, setEqEmpreiteiro] = useState("");
  const [eqFuncao, setEqFuncao] = useState("");
  const [eqQtd, setEqQtd] = useState(1);
  const [eqHoras, setEqHoras] = useState(8);

  // form state — atividade
  const [atEtapa, setAtEtapa] = useState<string>("");
  const [atSub, setAtSub] = useState<string>("");
  const [atDesc, setAtDesc] = useState("");
  const [atPct, setAtPct] = useState(0);

  // form state — ocorrência
  const [ocTipo, setOcTipo] = useState("outro");
  const [ocDesc, setOcDesc] = useState("");

  const carregar = async () => {
    const { data: r } = await supabase
      .from("rdos")
      .select("*")
      .eq("id", rdoId)
      .maybeSingle();
    setRdo(r as Rdo | null);

    const { data: o } = await supabase
      .from("obras")
      .select("id,customer_id,name,contact_email,contact_whatsapp")
      .eq("id", obraId)
      .maybeSingle();
    setObra(o as Obra | null);

    const [{ data: eq }, { data: at }, { data: oc }, { data: ax }, { data: et }, { data: sub }] =
      await Promise.all([
        supabase.from("rdo_equipes").select("*").eq("rdo_id", rdoId),
        supabase.from("rdo_atividades").select("*").eq("rdo_id", rdoId),
        supabase.from("rdo_ocorrencias").select("*").eq("rdo_id", rdoId),
        supabase.from("rdo_anexos").select("*").eq("rdo_id", rdoId),
        supabase.from("orcamento_etapas").select("id,nome").eq("obra_id", obraId).order("ordem"),
        supabase.from("orcamento_subetapas").select("id,nome,etapa_id"),
      ]);
    setEquipes((eq ?? []) as Equipe[]);
    setAtividades((at ?? []) as Atividade[]);
    setOcorrencias((oc ?? []) as Ocorrencia[]);
    setEtapas((et ?? []) as Etapa[]);
    setSubetapas((sub ?? []) as Subetapa[]);

    const anexosLista = (ax ?? []) as Anexo[];
    const comUrl = await Promise.all(
      anexosLista.map(async (a) => {
        const { data: signed } = await supabase.storage
          .from("obra-fotos")
          .createSignedUrl(a.storage_path, 3600);
        return { ...a, url: signed?.signedUrl };
      }),
    );
    setAnexos(comUrl);
  };

  useEffect(() => {
    void carregar();
  }, [rdoId]);

  const salvarCabecalho = async (e: FormEvent) => {
    e.preventDefault();
    if (!rdo) return;
    const { error } = await supabase
      .from("rdos")
      .update({
        clima_manha: rdo.clima_manha,
        clima_tarde: rdo.clima_tarde,
        clima_noite: rdo.clima_noite,
        condicao: rdo.condicao,
        responsavel: rdo.responsavel,
        observacoes: rdo.observacoes,
      })
      .eq("id", rdo.id);
    if (error) toast.error("Erro ao salvar", { description: error.message });
    else toast.success("Cabeçalho salvo");
  };

  const addEquipe = async () => {
    if (!rdo || !eqFuncao) return toast.error("Informe a função");
    const { error } = await supabase.from("rdo_equipes").insert({
      rdo_id: rdo.id,
      customer_id: rdo.customer_id,
      empreiteiro: eqEmpreiteiro || null,
      funcao: eqFuncao,
      quantidade: eqQtd,
      horas: eqHoras,
    });
    if (error) return toast.error(error.message);
    setEqEmpreiteiro("");
    setEqFuncao("");
    setEqQtd(1);
    setEqHoras(8);
    void carregar();
  };

  const delEquipe = async (id: string) => {
    await supabase.from("rdo_equipes").delete().eq("id", id);
    void carregar();
  };

  const addAtividade = async () => {
    if (!rdo || !atDesc) return toast.error("Informe a descrição");
    const { error } = await supabase.from("rdo_atividades").insert({
      rdo_id: rdo.id,
      customer_id: rdo.customer_id,
      etapa_id: atEtapa || null,
      subetapa_id: atSub || null,
      descricao: atDesc,
      percentual: atPct,
    });
    if (error) return toast.error(error.message);
    setAtEtapa("");
    setAtSub("");
    setAtDesc("");
    setAtPct(0);
    void carregar();
  };

  const delAtividade = async (id: string) => {
    await supabase.from("rdo_atividades").delete().eq("id", id);
    void carregar();
  };

  const addOcorrencia = async () => {
    if (!rdo || !ocDesc) return toast.error("Descreva a ocorrência");
    const { error } = await supabase.from("rdo_ocorrencias").insert({
      rdo_id: rdo.id,
      customer_id: rdo.customer_id,
      tipo: ocTipo,
      descricao: ocDesc,
    });
    if (error) return toast.error(error.message);
    setOcTipo("outro");
    setOcDesc("");
    void carregar();
  };

  const delOcorrencia = async (id: string) => {
    await supabase.from("rdo_ocorrencias").delete().eq("id", id);
    void carregar();
  };

  const uploadAnexos = async (files: FileList | null) => {
    if (!files?.length || !rdo || !obra) return;
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${obra.customer_id}/${obra.id}/rdo/${rdo.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("obra-fotos").upload(path, file);
      if (upErr) {
        toast.error("Falha no upload", { description: upErr.message });
        continue;
      }
      await supabase.from("rdo_anexos").insert({
        rdo_id: rdo.id,
        obra_id: obra.id,
        customer_id: obra.customer_id,
        storage_path: path,
        tipo: file.type.startsWith("image/") ? "foto" : "documento",
        created_by: user!.id,
      });
    }
    toast.success("Anexos enviados");
    void carregar();
  };

  const delAnexo = async (a: Anexo) => {
    await supabase.storage.from("obra-fotos").remove([a.storage_path]);
    await supabase.from("rdo_anexos").delete().eq("id", a.id);
    void carregar();
  };

  const montarRelatorio = () => {
    if (!rdo || !obra) return "";
    const eqTxt = equipes
      .map((e) => `• ${e.funcao}${e.empreiteiro ? ` (${e.empreiteiro})` : ""} — ${e.quantidade}x, ${e.horas}h`)
      .join("\n");
    const atTxt = atividades
      .map((a) => `• ${a.descricao} (${a.percentual}%)`)
      .join("\n");
    const ocTxt = ocorrencias
      .map((o) => `• [${o.tipo}] ${o.descricao}`)
      .join("\n");
    return [
      `*RDO — ${obra.name}*`,
      `Data: ${new Date(rdo.data + "T00:00:00").toLocaleDateString("pt-BR")}`,
      `Condição: ${rdo.condicao}`,
      rdo.responsavel ? `Responsável: ${rdo.responsavel}` : null,
      [rdo.clima_manha, rdo.clima_tarde, rdo.clima_noite].filter(Boolean).length
        ? `\nClima: manhã ${rdo.clima_manha ?? "—"} / tarde ${rdo.clima_tarde ?? "—"} / noite ${rdo.clima_noite ?? "—"}`
        : null,
      eqTxt ? `\nEquipe:\n${eqTxt}` : null,
      atTxt ? `\nAtividades:\n${atTxt}` : null,
      ocTxt ? `\nOcorrências:\n${ocTxt}` : null,
      rdo.observacoes ? `\nObservações:\n${rdo.observacoes}` : null,
      anexos.length ? `\n${anexos.length} anexo(s).` : null,
      `\n— Mestre 360`,
    ]
      .filter(Boolean)
      .join("\n");
  };

  const enviarWhats = () => {
    if (!obra?.contact_whatsapp) return toast.error("Cadastre o WhatsApp do contato da obra");
    const tel = obra.contact_whatsapp.replace(/\D/g, "");
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(montarRelatorio())}`, "_blank");
  };
  const enviarEmail = () => {
    if (!obra?.contact_email) return toast.error("Cadastre o e-mail do contato");
    const subject = `RDO ${obra.name} - ${new Date(rdo!.data + "T00:00:00").toLocaleDateString("pt-BR")}`;
    window.location.href = `mailto:${obra.contact_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(montarRelatorio())}`;
  };

  if (!rdo || !obra) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando...</div>;
  }

  const subFiltradas = subetapas.filter((s) => s.etapa_id === atEtapa);

  return (
    <div>
      <PageHeader
        title={`RDO — ${new Date(rdo.data + "T00:00:00").toLocaleDateString("pt-BR")}`}
        description={obra.name}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/app/obras/$obraId/rdo" params={{ obraId }}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Link>
            </Button>
            <Button variant="outline" onClick={enviarWhats}>
              <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
            </Button>
            <Button variant="outline" onClick={enviarEmail}>
              <Mail className="mr-2 h-4 w-4" /> E-mail
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-8">
        {/* Cabeçalho */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informações gerais</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={salvarCabecalho} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Clima manhã</Label>
                  <Input
                    value={rdo.clima_manha ?? ""}
                    onChange={(e) => setRdo({ ...rdo, clima_manha: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Clima tarde</Label>
                  <Input
                    value={rdo.clima_tarde ?? ""}
                    onChange={(e) => setRdo({ ...rdo, clima_tarde: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Clima noite</Label>
                  <Input
                    value={rdo.clima_noite ?? ""}
                    onChange={(e) => setRdo({ ...rdo, clima_noite: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Condição</Label>
                  <Select
                    value={rdo.condicao}
                    onValueChange={(v) => setRdo({ ...rdo, condicao: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="praticavel">Praticável</SelectItem>
                      <SelectItem value="parcial">Parcialmente praticável</SelectItem>
                      <SelectItem value="impraticavel">Impraticável</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Input
                    value={rdo.responsavel ?? ""}
                    onChange={(e) => setRdo({ ...rdo, responsavel: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observações gerais</Label>
                <Textarea
                  rows={2}
                  value={rdo.observacoes ?? ""}
                  onChange={(e) => setRdo({ ...rdo, observacoes: e.target.value })}
                />
              </div>
              <Button type="submit" size="sm">
                <Save className="mr-2 h-4 w-4" /> Salvar
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Equipes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" /> Equipe ({equipes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
              <Input
                placeholder="Empreiteiro"
                value={eqEmpreiteiro}
                onChange={(e) => setEqEmpreiteiro(e.target.value)}
              />
              <Input
                placeholder="Função"
                value={eqFuncao}
                onChange={(e) => setEqFuncao(e.target.value)}
              />
              <Input
                type="number"
                min={1}
                placeholder="Qtd"
                value={eqQtd}
                onChange={(e) => setEqQtd(Number(e.target.value))}
              />
              <Input
                type="number"
                step="0.5"
                placeholder="Horas"
                value={eqHoras}
                onChange={(e) => setEqHoras(Number(e.target.value))}
              />
              <Button onClick={addEquipe}>Adicionar</Button>
            </div>
            {equipes.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-md border p-2 text-sm"
              >
                <span>
                  <strong>{e.funcao}</strong>
                  {e.empreiteiro ? ` — ${e.empreiteiro}` : ""} • {e.quantidade}x • {e.horas}h
                </span>
                <Button variant="ghost" size="sm" onClick={() => delEquipe(e.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Atividades */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" /> Atividades ({atividades.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Select value={atEtapa} onValueChange={(v) => { setAtEtapa(v); setAtSub(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Etapa (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {etapas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={atSub} onValueChange={setAtSub} disabled={!atEtapa || subFiltradas.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder="Subetapa (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {subFiltradas.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              rows={2}
              placeholder="Descrição da atividade"
              value={atDesc}
              onChange={(e) => setAtDesc(e.target.value)}
            />
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">% concluído no dia</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={atPct}
                  onChange={(e) => setAtPct(Number(e.target.value))}
                />
              </div>
              <Button onClick={addAtividade}>Adicionar</Button>
            </div>
            {atividades.map((a) => {
              const etapaNome = etapas.find((e) => e.id === a.etapa_id)?.nome;
              const subNome = subetapas.find((s) => s.id === a.subetapa_id)?.nome;
              return (
                <div
                  key={a.id}
                  className="flex items-start justify-between rounded-md border p-2 text-sm"
                >
                  <div>
                    {(etapaNome || subNome) && (
                      <p className="text-xs text-muted-foreground">
                        {etapaNome}{subNome ? ` › ${subNome}` : ""}
                      </p>
                    )}
                    <p>{a.descricao}</p>
                    <p className="text-xs text-muted-foreground">{a.percentual}% concluído</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => delAtividade(a.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Ocorrências */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" /> Ocorrências ({ocorrencias.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
              <Select value={ocTipo} onValueChange={setOcTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="atraso">Atraso</SelectItem>
                  <SelectItem value="acidente">Acidente</SelectItem>
                  <SelectItem value="visita">Visita</SelectItem>
                  <SelectItem value="entrega">Entrega</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
              <Input
                className="md:col-span-2"
                placeholder="Descrição"
                value={ocDesc}
                onChange={(e) => setOcDesc(e.target.value)}
              />
              <Button onClick={addOcorrencia}>Adicionar</Button>
            </div>
            {ocorrencias.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between rounded-md border p-2 text-sm"
              >
                <span>
                  <strong className="capitalize">{o.tipo}:</strong> {o.descricao}
                </span>
                <Button variant="ghost" size="sm" onClick={() => delOcorrencia(o.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Anexos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="h-4 w-4" /> Anexos ({anexos.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent">
              <Camera className="h-4 w-4" /> Adicionar fotos/documentos
              <input
                type="file"
                multiple
                accept="image/*,application/pdf"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  void uploadAnexos(e.target.files);
                  e.target.value = "";
                }}
              />
            </Label>
            {anexos.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {anexos.map((a) => (
                  <div key={a.id} className="group relative">
                    {a.tipo === "foto" && a.url ? (
                      <img
                        src={a.url}
                        alt={a.legenda ?? ""}
                        className="h-28 w-full rounded-md object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-28 w-full items-center justify-center rounded-md bg-muted text-xs text-muted-foreground"
                      >
                        Documento
                      </a>
                    )}
                    <button
                      onClick={() => void delAnexo(a)}
                      className="absolute right-1 top-1 rounded bg-background/80 p-1 opacity-0 transition group-hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
