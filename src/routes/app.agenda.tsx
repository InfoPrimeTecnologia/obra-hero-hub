import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentCustomerId } from "@/lib/use-current-customer";
import { useObraSelecionada } from "@/lib/obra-context";

export const Route = createFileRoute("/app/agenda")({ component: AgendaPage });

type Evento = {
  id: string;
  titulo: string;
  descricao: string | null;
  local: string | null;
  cor: string | null;
  dia_inteiro: boolean;
  dt_inicio: string;
  dt_fim: string;
  obra_id: string | null;
  tarefa_id: string | null;
};

function toLocalInput(dt: string) {
  const d = new Date(dt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AgendaPage() {
  const qc = useQueryClient();
  const { customerId } = useCurrentCustomerId();
  const { obra } = useObraSelecionada();
  const obraId = obra?.id ?? null;
  const [dialog, setDialog] = useState<{ open: boolean; evento?: Evento | null; initialDate?: Date }>({ open: false });

  const eventosQ = useQuery({
    enabled: !!customerId,
    queryKey: ["eventos_agenda", customerId, obraId],
    queryFn: async () => {
      let q = (supabase as any).from("eventos_agenda").select("*").eq("customer_id", customerId).order("dt_inicio");
      if (obraId) q = q.eq("obra_id", obraId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as Evento[];
    },
  });

  const fcEvents = useMemo(
    () =>
      (eventosQ.data ?? []).map((e) => ({
        id: e.id,
        title: e.titulo,
        start: e.dt_inicio,
        end: e.dt_fim,
        allDay: e.dia_inteiro,
        backgroundColor: e.cor ?? "#3b82f6",
        borderColor: e.cor ?? "#3b82f6",
        extendedProps: { evento: e },
      })),
    [eventosQ.data],
  );

  if (!customerId) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Agenda</h1>
          <p className="text-sm text-muted-foreground">
            Clique num dia para criar evento {obra ? `· ${obra.name}` : "(geral)"}
          </p>
        </div>
        <Button onClick={() => setDialog({ open: true, initialDate: new Date() })}>
          <Plus className="mr-2 h-4 w-4" /> Novo evento
        </Button>
      </div>

      <div className="flex-1 overflow-auto rounded-lg border bg-card p-3">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale={ptBrLocale}
          height="auto"
          headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
          buttonText={{ today: "Hoje", month: "Mês", week: "Semana", day: "Dia" }}
          selectable
          editable
          dateClick={(info) => setDialog({ open: true, initialDate: info.date })}
          eventClick={(info) => setDialog({ open: true, evento: info.event.extendedProps.evento as Evento })}
          eventDrop={async (info) => {
            const ev = info.event.extendedProps.evento as Evento;
            await (supabase as any).from("eventos_agenda").update({
              dt_inicio: info.event.start?.toISOString(),
              dt_fim: (info.event.end ?? info.event.start)?.toISOString(),
            }).eq("id", ev.id);
            qc.invalidateQueries({ queryKey: ["eventos_agenda", customerId, obraId] });
          }}
          events={fcEvents}
        />
      </div>

      {dialog.open && (
        <EventoDialog
          customerId={customerId}
          obraId={obraId}
          evento={dialog.evento ?? null}
          initialDate={dialog.initialDate ?? new Date()}
          onClose={() => {
            setDialog({ open: false });
            qc.invalidateQueries({ queryKey: ["eventos_agenda", customerId, obraId] });
          }}
        />
      )}
    </div>
  );
}

function EventoDialog({
  customerId,
  obraId,
  evento,
  initialDate,
  onClose,
}: {
  customerId: string;
  obraId: string | null;
  evento: Evento | null;
  initialDate: Date;
  onClose: () => void;
}) {
  const start = evento ? toLocalInput(evento.dt_inicio) : toLocalInput(new Date(initialDate.getTime() + 9 * 3600_000).toISOString());
  const end = evento ? toLocalInput(evento.dt_fim) : toLocalInput(new Date(initialDate.getTime() + 10 * 3600_000).toISOString());
  const [form, setForm] = useState({
    titulo: evento?.titulo ?? "",
    descricao: evento?.descricao ?? "",
    local: evento?.local ?? "",
    cor: evento?.cor ?? "#3b82f6",
    dia_inteiro: evento?.dia_inteiro ?? false,
    dt_inicio: start,
    dt_fim: end,
    tarefa_id: evento?.tarefa_id ?? "",
  });
  const [saving, setSaving] = useState(false);

  const tarefasQ = useQuery({
    queryKey: ["tarefas-select", customerId, obraId],
    queryFn: async () => {
      let q = (supabase as any).from("tarefas").select("id, titulo").eq("customer_id", customerId).limit(200);
      if (obraId) q = q.eq("obra_id", obraId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const save = async () => {
    if (!form.titulo.trim()) return toast.error("Título obrigatório");
    setSaving(true);
    try {
      const payload: any = {
        customer_id: customerId,
        obra_id: obraId,
        titulo: form.titulo,
        descricao: form.descricao || null,
        local: form.local || null,
        cor: form.cor,
        dia_inteiro: form.dia_inteiro,
        dt_inicio: new Date(form.dt_inicio).toISOString(),
        dt_fim: new Date(form.dt_fim).toISOString(),
        tarefa_id: form.tarefa_id || null,
      };
      if (evento) {
        const { error } = await (supabase as any).from("eventos_agenda").update(payload).eq("id", evento.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await (supabase as any).from("eventos_agenda").insert(payload);
        if (error) throw new Error(error.message);
      }
      toast.success(evento ? "Evento atualizado" : "Evento criado");
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!evento) return;
    if (!confirm("Excluir evento?")) return;
    await (supabase as any).from("eventos_agenda").delete().eq("id", evento.id);
    toast.success("Excluído");
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{evento ? "Editar evento" : "Novo evento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título *</Label>
            <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início</Label>
              <Input type="datetime-local" value={form.dt_inicio} onChange={(e) => setForm({ ...form, dt_inicio: e.target.value })} />
            </div>
            <div>
              <Label>Fim</Label>
              <Input type="datetime-local" value={form.dt_fim} onChange={(e) => setForm({ ...form, dt_fim: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.dia_inteiro} onChange={(e) => setForm({ ...form, dia_inteiro: e.target.checked })} />
              Dia inteiro
            </label>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Cor</Label>
              <input
                type="color"
                value={form.cor}
                onChange={(e) => setForm({ ...form, cor: e.target.value })}
                className="h-8 w-12 cursor-pointer rounded border"
              />
            </div>
          </div>
          <div>
            <Label>Local</Label>
            <Input value={form.local ?? ""} onChange={(e) => setForm({ ...form, local: e.target.value })} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea rows={2} value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          <div>
            <Label>Vincular a tarefa</Label>
            <Select value={form.tarefa_id || "none"} onValueChange={(v) => setForm({ ...form, tarefa_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {(tarefasQ.data ?? []).map((t: any) => <SelectItem key={t.id} value={t.id}>{t.titulo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {evento && (
            <Button variant="destructive" onClick={remove}>
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
