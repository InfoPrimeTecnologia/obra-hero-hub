import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Plus, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/configuracoes")({
  component: ConfiguracoesPage,
});

type AllowlistRow = { email: string; created_at: string };

function ConfiguracoesPage() {
  const [admins, setAdmins] = useState<AllowlistRow[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("admin_allowlist")
      .select("email, created_at")
      .order("created_at", { ascending: false });
    setAdmins((data ?? []) as AllowlistRow[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Senha deve ter pelo menos 6 caracteres");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("create-admin-user", {
      body: { email, password, fullName },
    });
    setSaving(false);
    if (error || (data && data.error)) {
      toast.error("Falha ao criar admin", {
        description: (data?.error as string) ?? error?.message,
      });
      return;
    }
    toast.success("Admin criado com sucesso");
    setFullName("");
    setEmail("");
    setPassword("");
    setOpen(false);
    void load();
  };

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Integrações, templates de mensagens e administradores"
      />
      <div className="space-y-6 p-8">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Super administradores
              </CardTitle>
              <CardDescription>
                Usuários com acesso total ao painel administrativo.
              </CardDescription>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo admin
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar super administrador</DialogTitle>
                  <DialogDescription>
                    A conta será criada com acesso imediato ao painel.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="a-name">Nome completo</Label>
                    <Input id="a-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="a-email">E-mail *</Label>
                    <Input
                      id="a-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="a-pass">Senha *</Label>
                    <Input
                      id="a-pass"
                      type="password"
                      minLength={6}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? "Criando..." : "Criar admin"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {admins.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum admin cadastrado.</p>
            ) : (
              <ul className="divide-y divide-border">
                {admins.map((a) => (
                  <li key={a.email} className="flex items-center justify-between py-3 text-sm">
                    <span className="font-medium">{a.email}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Em breve: ASAAS, WhatsApp, e-mails e templates.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
