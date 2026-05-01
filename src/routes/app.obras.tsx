import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, FolderOpen, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useObraSelecionada, type Obra } from "@/lib/obra-context";
import { toast } from "sonner";

export const Route = createFileRoute("/app/obras")({
  component: ObrasPage,
});

function ObrasPage() {
  const { user } = useAuth();
  const { obra: obraAtiva, setObra } = useObraSelecionada();
  const navigate = useNavigate();
  const [obras, setObras] = useState<Obra[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactWhatsapp, setContactWhatsapp] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  const carregar = async () => {
    const { data, error } = await supabase
      .from("obras")
      .select(
        "id,name,customer_id,contact_name,contact_email,contact_whatsapp,address_city,address_state,status",
      )
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar obras", { description: error.message });
      return;
    }
    setObras((data ?? []) as Obra[]);
  };

  useEffect(() => {
    void carregar();
  }, []);

  const resetForm = () => {
    setName("");
    setDescription("");
    setContactName("");
    setContactEmail("");
    setContactWhatsapp("");
    setCity("");
    setState("");
  };

  const cadastrar = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    // pega customer_id do usuário
    const { data: customer, error: cErr } = await supabase
      .from("customers")
      .select("id")
      .eq("owner_user_id", user!.id)
      .maybeSingle();
    if (cErr || !customer) {
      setSaving(false);
      toast.error("Não foi possível identificar sua empresa.");
      return;
    }
    const { error } = await supabase.from("obras").insert({
      customer_id: customer.id,
      name,
      description: description || null,
      contact_name: contactName || null,
      contact_email: contactEmail || null,
      contact_whatsapp: contactWhatsapp || null,
      address_city: city || null,
      address_state: state || null,
      created_by: user!.id,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao cadastrar obra", { description: error.message });
      return;
    }
    toast.success("Obra cadastrada!");
    resetForm();
    setOpen(false);
    void carregar();
  };

  const abrirObra = (o: Obra) => {
    setObra(o);
    toast.success(`Obra ativa: ${o.name}`);
    navigate({ to: "/app/obras/$obraId/diario", params: { obraId: o.id } });
  };

  return (
    <div>
      <PageHeader
        title="Obras"
        description="Cadastre, abra e gerencie suas obras"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Nova obra
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Cadastrar obra</DialogTitle>
              </DialogHeader>
              <form onSubmit={cadastrar} className="space-y-3">
                <div className="space-y-2">
                  <Label>Nome da obra *</Label>
                  <Input required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>UF</Label>
                    <Input
                      maxLength={2}
                      value={state}
                      onChange={(e) => setState(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Responsável da obra</Label>
                  <Input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Nome para envio do diário"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>E-mail do contato</Label>
                    <Input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>WhatsApp do contato</Label>
                    <Input
                      value={contactWhatsapp}
                      onChange={(e) => setContactWhatsapp(e.target.value)}
                      placeholder="55119..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Salvando..." : "Cadastrar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="space-y-3 p-8">
        {obras.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma obra cadastrada ainda. Clique em "Nova obra" para começar.
            </CardContent>
          </Card>
        ) : (
          obras.map((o) => {
            const ativa = obraAtiva?.id === o.id;
            return (
              <Card key={o.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{o.name}</p>
                      {ativa && (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Ativa
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[o.address_city, o.address_state].filter(Boolean).join(" / ") ||
                        "Sem endereço"}
                      {o.contact_name ? ` • Resp.: ${o.contact_name}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={ativa ? "default" : "outline"}
                      size="sm"
                      onClick={() => abrirObra(o)}
                    >
                      <FolderOpen className="mr-2 h-4 w-4" />
                      {ativa ? "Abrir diário" : "Abrir"}
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/app/obras/$obraId/diario" params={{ obraId: o.id }}>
                        Diário
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
