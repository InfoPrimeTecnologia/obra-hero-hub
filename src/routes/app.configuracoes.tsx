import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/configuracoes")({
  component: ConfiguracoesPage,
});

type Empresa = {
  id?: string;
  company_name?: string | null;
  cpf_cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
  notes?: string | null;
};

function ConfiguracoesPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [empresa, setEmpresa] = useState<Empresa>({});

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("customers")
        .select("*")
        .eq("owner_user_id", user.id)
        .maybeSingle();
      if (data) setEmpresa(data);
      setLoading(false);
    })();
  }, [user]);

  const set = <K extends keyof Empresa>(k: K, v: Empresa[K]) =>
    setEmpresa((prev) => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    if (empresa.id) {
      const { error } = await supabase
        .from("customers")
        .update({
          company_name: empresa.company_name,
          cpf_cnpj: empresa.cpf_cnpj,
          phone: empresa.phone,
          whatsapp: empresa.whatsapp,
          address_street: empresa.address_street,
          address_number: empresa.address_number,
          address_complement: empresa.address_complement,
          address_neighborhood: empresa.address_neighborhood,
          address_city: empresa.address_city,
          address_state: empresa.address_state,
          address_zip: empresa.address_zip,
          notes: empresa.notes,
        })
        .eq("id", empresa.id);
      setSaving(false);
      if (error) toast.error(error.message);
      else toast.success("Configurações salvas");
    } else {
      const { id: _ignore, ...rest } = empresa;
      const { error, data } = await supabase
        .from("customers")
        .insert({
          ...rest,
          name: empresa.company_name || user.email || "Minha empresa",
          email: user.email!,
          owner_user_id: user.id,
          created_by: user.id,
        })
        .select()
        .single();
      setSaving(false);
      if (error) toast.error(error.message);
      else {
        toast.success("Empresa criada");
        if (data) setEmpresa(data);
      }
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Gerencie informações da empresa e preferências do sistema</p>
      </div>

      <Tabs defaultValue="empresa">
        <TabsList>
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="endereco">Endereço</TabsTrigger>
          <TabsTrigger value="preferencias">Preferências</TabsTrigger>
        </TabsList>

        <TabsContent value="empresa" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dados da empresa</CardTitle>
              <CardDescription>Informações principais usadas em documentos e relatórios</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Razão social / Nome fantasia</Label>
                <Input value={empresa.company_name ?? ""} onChange={(e) => set("company_name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>CNPJ / CPF</Label>
                <Input value={empresa.cpf_cnpj ?? ""} onChange={(e) => set("cpf_cnpj", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input value={empresa.email ?? user?.email ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={empresa.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input value={empresa.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="endereco" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Endereço</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Logradouro</Label>
                <Input value={empresa.address_street ?? ""} onChange={(e) => set("address_street", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Número</Label>
                <Input value={empresa.address_number ?? ""} onChange={(e) => set("address_number", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Complemento</Label>
                <Input value={empresa.address_complement ?? ""} onChange={(e) => set("address_complement", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input value={empresa.address_neighborhood ?? ""} onChange={(e) => set("address_neighborhood", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input value={empresa.address_zip ?? ""} onChange={(e) => set("address_zip", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={empresa.address_city ?? ""} onChange={(e) => set("address_city", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Input value={empresa.address_state ?? ""} onChange={(e) => set("address_state", e.target.value)} maxLength={2} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferencias" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Observações e preferências</CardTitle>
              <CardDescription>Notas internas da empresa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  rows={5}
                  value={empresa.notes ?? ""}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Observações internas sobre a empresa..."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}
