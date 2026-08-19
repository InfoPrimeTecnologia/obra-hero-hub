// Utilitários de data no fuso local (evita o "dia anterior" causado por
// datas ISO puras (yyyy-mm-dd) serem interpretadas como UTC pelo navegador).

/** Data de hoje em yyyy-mm-dd usando o fuso do usuário. */
export function hojeISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

/** Formata yyyy-mm-dd (ou timestamp ISO) como dd/mm/aaaa sem deslocar o dia. */
export function fmtDataBR(value?: string | null): string {
  if (!value) return "—";
  const iso = String(value);
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR");
}

/** Converte yyyy-mm-dd em timestamp ao meio-dia local (seguro para timestamptz). */
export function dataParaTimestamp(ymd: string): string {
  return `${ymd.slice(0, 10)}T12:00:00`;
}
