import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2, Copy, Mail, Shield, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  listTeamMembers,
  createTeamMember,
  createTeamInvite,
  removeTeamMember,
  updateTeamMember,
  revokeTeamInvite,
  TEAM_MODULES,
} from "@/lib/team.functions";

export const Route = createFileRoute("/app/configuracoes/usuarios")({ component: UsuariosPage });

const MODULE_LABELS: Record<string, string> = {
  obras: "Obras",
  financeiro: "Financeiro",
  compras: "Compras",
  estoque: "Estoque",
  rh: "RH",
  relatorios: "Relatórios",
  tarefas: "Tarefas",
  agenda: "Agenda",
};
const ACTIONS = ["view", "create", "edit", "delete"] as const;
const ACTION_LABELS: Record<string, string> = { view: "Ver", create: "Criar", edit: "Editar", delete: "Excluir" };

type PermMap = Record<string, { view?: boolean; create?: boolean; edit?: boolean; delete?: boolean }>;

function defaultPerms(): PermMap {
  const p: PermMap = {};
  for (const m of TEAM_MODULES) p[m] = { view: true };
  return p;
}

function UsuariosPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTeamMembers);
  const createDirect = useServerFn(createTeamMember);
  const createInvite = useServerFn(createTeamInvite);
  const removeFn = useServerFn(removeTeamMember);
  const revokeFn = useServerFn(revokeTeamInvite);
  const updateFn = useServerFn(updateTeamMember);

  const list = useQuery({ queryKey: ["team"], queryFn: () => listFn() });
  const [dialog, setDialog] = useState<{ open: boolean; mode: "direct" | "invite" } | null>(null);

  const createMut = useMutation({
    mutationFn: async (input: any) => {
      if (dialog?.mode === "direct") return createDirect({ data: input });
      const r = await createInvite({ data: input });
      return r;
    },
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["team"] });
      setDialog(null);
      if (r?.invite?.token) {
        const url = `${window.location.origin}/convite/${r.invite.token}`;
        navigator.clipboard.writeText(url).catch(() => {});
        toast.success("Convite criado e link copiado", { description: url });
      } else {
        toast.success("Usuário criado");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (memberId: string) => removeFn({ data: { memberId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team"] }); toast.success("Usuário removido"); },
    onError: (e: any) => toast.error(e.message),
  });
  const revokeMut = useMutation({
    mutationFn: (inviteId: string) => revokeFn({ data: { inviteId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team"] }); toast.success("Convite revogado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const suspendMut = useMutation({
    mutationFn: (v: { memberId: string; status: "ativo" | "suspenso" }) =>
      updateFn({ data: { memberId: v.memberId, status: v.status } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const data = list.data;
  const used = (data?.members?.length ?? 0) + 1;
  const max = data?.max_usuarios ?? null;

  return (
    <div className="p-8">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Usuários da empresa</h1>
          <p className="text-sm text-muted-foreground">
            Crie contas para sua equipe ou envie convites por e-mail · {used}{max ? `/${max}` : ""} usuários
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDialog({ open: true, mode: "invite" })}>
            <Mail className="mr-2 h-4 w-4" /> Convidar por e-mail
          </Button>
          <Button onClick={() => setDialog({ open: true, mode: "direct" })}>
            <Plus className="mr-2 h-4 w-4" /> Criar usuário direto
          </Button>
        </div>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Membros ({data?.members?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="invites">Convites pendentes ({data?.invites?.length ?? 0})</TabsTrigger>
        </TabsList>
        <TabsContent value="members" className="space-y-2 pt-3">
          {list.isLoading ? (
            <div className="p-8 text-sm text-muted-foreground"><Loader2 className="inline mr-2 h-4 w-4 animate-spin" /> Carregando…</div>
          ) : (data?.members ?? []).length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum membro além de você.</CardContent></Card>
          ) : (
            (data?.members ?? []).map((m: any) => (
              <Card key={m.id}>
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <UserCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{m.full_name || m.email}</p>
                      <Badge variant={m.role === "admin" ? "default" : "secondary"}>{m.role}</Badge>
                      {m.status === "suspenso" && <Badge variant="destructive">Suspenso</Badge>}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => suspendMut.mutate({ memberId: m.id, status: m.status === "ativo" ? "suspenso" : "ativo" })}
                  >
                    {m.status === "ativo" ? "Suspender" : "Reativar"}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover usuário desta empresa?")) removeMut.mutate(m.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
        <TabsContent value="invites" className="space-y-2 pt-3">
          {(data?.invites ?? []).length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum convite pendente.</CardContent></Card>
          ) : (
            (data?.invites ?? []).map((inv: any) => {
              const url = `${typeof window !== "undefined" ? window.location.origin : ""}/convite/${inv.token}`;
              return (
                <Card key={inv.id}>
                  <CardContent className="flex items-center gap-3 p-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{inv.email}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {inv.role} · expira {new Date(inv.expires_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado"); }}>
                      <Copy className="mr-1 h-3 w-3" /> Copiar link
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => revokeMut.mutate(inv.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {dialog?.open && (
        <UserDialog
          mode={dialog.mode}
          saving={createMut.isPending}
          onClose={() => setDialog(null)}
          onSubmit={(v) => createMut.mutate(v)}
        />
      )}
    </div>
  );
}

function UserDialog({
  mode,
  onClose,
  onSubmit,
  saving,
}: {
  mode: "direct" | "invite";
  onClose: () => void;
  onSubmit: (v: any) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "member" as "admin" | "member",
    permissions: defaultPerms(),
    can_access_all_obras: true,
    allowed_obras: [] as string[],
  });

  const toggle = (mod: string, act: typeof ACTIONS[number]) => {
    setForm((f) => ({
      ...f,
      permissions: { ...f.permissions, [mod]: { ...f.permissions[mod], [act]: !f.permissions[mod]?.[act] } },
    }));
  };

  const submit = () => {
    if (!form.email) return toast.error("E-mail obrigatório");
    if (mode === "direct" && !form.password) return toast.error("Senha obrigatória");
    if (mode === "direct" && !form.full_name) return toast.error("Nome obrigatório");
    const payload: any = {
      email: form.email,
      full_name: form.full_name,
      role: form.role,
      permissions: form.permissions,
      can_access_all_obras: form.can_access_all_obras,
      allowed_obras: form.allowed_obras,
    };
    if (mode === "direct") payload.password = form.password;
    onSubmit(payload);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "direct" ? "Criar usuário direto" : "Convidar por e-mail"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>E-mail *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>{mode === "direct" ? "Nome *" : "Nome (opcional)"}</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            {mode === "direct" && (
              <div>
                <Label>Senha *</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
            )}
            <div>
              <Label>Função</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Membro</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded border">
            <div className="flex items-center gap-2 border-b bg-muted/40 p-2 text-sm font-semibold">
              <Shield className="h-4 w-4" /> Permissões por módulo
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/20 text-xs">
                <tr>
                  <th className="p-2 text-left">Módulo</th>
                  {ACTIONS.map((a) => <th key={a} className="p-2 text-center">{ACTION_LABELS[a]}</th>)}
                </tr>
              </thead>
              <tbody>
                {TEAM_MODULES.map((m) => (
                  <tr key={m} className="border-t">
                    <td className="p-2">{MODULE_LABELS[m] ?? m}</td>
                    {ACTIONS.map((a) => (
                      <td key={a} className="p-2 text-center">
                        <Checkbox checked={!!form.permissions[m]?.[a]} onCheckedChange={() => toggle(m, a)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.can_access_all_obras}
              onCheckedChange={(v) => setForm({ ...form, can_access_all_obras: !!v })}
            />
            Acesso a todas as obras (desmarque para restringir)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {mode === "direct" ? "Criar usuário" : "Gerar convite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
