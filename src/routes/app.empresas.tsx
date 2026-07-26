import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, Building2, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/app/empresas")({
  component: EmpresasPage,
});

type Empresa = {
  id: string;
  nome: string;
  cnpj: string | null;
  customer_id: string;
};

function EmpresasPage() {
  const { user } = useAuth();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");

  const carregar = async () => {
    const { data, error } = await supabase
      .from("empresas")
      .select("id,nome,cnpj,customer_id")
      .order("nome");
    if (error) {
      toast.error("Erro ao carregar empresas", { description: error.message });
      return;
    }
    setEmpresas((data ?? []) as Empresa[]);
  };

  useEffect(() => {
    void carregar();
  }, []);

  const reset = () => {
    setNome("");
    setCnpj("");
    setEditing(null);
  };

  const abrirNova = () => {
    reset();
    setOpen(true);
  };

  const abrirEdicao = (e: Empresa) => {
    setEditing(e);
    setNome(e.nome);
    setCnpj(e.cnpj ?? "");
    setOpen(true);
  };

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from("empresas")
        .update({ nome, cnpj: cnpj || null })
        .eq("id", editing.id);
      setSaving(false);
      if (error) {
        toast.error("Erro ao salvar", { description: error.message });
        return;
      }
      toast.success("Empresa atualizada");
    } else {
      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("owner_user_id", user!.id)
        .maybeSingle();
      if (!customer) {
        setSaving(false);
        toast.error("Não foi possível identificar sua conta.");
        return;
      }
      const { error } = await supabase.from("empresas").insert({
        customer_id: customer.id,
        nome,
        cnpj: cnpj || null,
        created_by: user!.id,
      });
      setSaving(false);
      if (error) {
        toast.error("Erro ao cadastrar", { description: error.message });
        return;
      }
      toast.success("Empresa cadastrada");
    }
    reset();
    setOpen(false);
    void carregar();
  };

  const excluir = async (id: string) => {
    const { error } = await supabase.from("empresas").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir", { description: error.message });
      return;
    }
    toast.success("Empresa excluída");
    void carregar();
  };

  return (
    <div>
      <PageHeader
        title="Empresas"
        info="Empresas (clientes) do seu portfólio. Cada obra pertence a uma empresa."
        description="Gerencie as empresas que possuem suas obras"
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
              <Button onClick={abrirNova}>
                <Plus className="mr-2 h-4 w-4" /> Nova empresa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Editar empresa" : "Cadastrar empresa"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={salvar} className="space-y-3">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input required value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="space-y-3 p-8">
        {empresas.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma empresa cadastrada. Cadastre uma empresa para começar a registrar obras.
            </CardContent>
          </Card>
        ) : (
          empresas.map((e) => (
            <Card key={e.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">{e.nome}</p>
                    {e.cnpj && (
                      <p className="text-xs text-muted-foreground">CNPJ: {e.cnpj}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => abrirEdicao(e)}>
                    <Pencil className="mr-2 h-4 w-4" /> Editar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Todas as obras vinculadas a esta empresa também serão excluídas. Essa ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => excluir(e.id)}>
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
