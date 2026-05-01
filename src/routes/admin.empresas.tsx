import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/empresas")({
  component: EmpresasPage,
});

type Customer = {
  id: string;
  name: string;
  email: string;
  company_name: string | null;
  cpf_cnpj: string | null;
  phone: string | null;
  status: string;
  created_at: string;
};

function EmpresasPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [phone, setPhone] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, email, company_name, cpf_cnpj, phone, status, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar empresas", { description: error.message });
    } else {
      setCustomers((data ?? []) as Customer[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const reset = () => {
    setName("");
    setCompanyName("");
    setEmail("");
    setCpfCnpj("");
    setPhone("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("customers").insert({
      name,
      email,
      company_name: companyName || null,
      cpf_cnpj: cpfCnpj || null,
      phone: phone || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao cadastrar", { description: error.message });
      return;
    }
    toast.success("Empresa cadastrada");
    reset();
    setOpen(false);
    void load();
  };

  return (
    <div>
      <PageHeader
        title="Empresas"
        description="Gerencie as empresas cadastradas na plataforma"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova empresa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Cadastrar empresa</DialogTitle>
                <DialogDescription>
                  Adicione uma nova empresa cliente ao sistema.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="c-name">Nome do responsável *</Label>
                  <Input id="c-name" required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-company">Nome da empresa</Label>
                  <Input id="c-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-email">E-mail *</Label>
                  <Input
                    id="c-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="c-cpf">CPF / CNPJ</Label>
                    <Input id="c-cpf" value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="c-phone">Telefone</Label>
                    <Input id="c-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Salvando..." : "Cadastrar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="p-8">
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center p-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando...
              </div>
            ) : customers.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                Nenhuma empresa cadastrada ainda.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>CPF / CNPJ</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.company_name ?? "—"}</TableCell>
                      <TableCell>{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">{c.email}</TableCell>
                      <TableCell className="text-muted-foreground">{c.cpf_cnpj ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={c.status === "active" ? "default" : "secondary"}>
                          {c.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
