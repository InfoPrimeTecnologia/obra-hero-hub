// CSV export utility com BOM UTF-8 + separador ";" (Excel pt-BR)
const BOM = "\uFEFF";

function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // Se contém aspas, separador ou quebra de linha, envolve em aspas e escapa internas
  if (/[";\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(rows: (string | number | null | undefined)[][], headers?: string[]): string {
  const lines: string[] = [];
  if (headers) lines.push(headers.map(escapeCell).join(";"));
  for (const r of rows) lines.push(r.map(escapeCell).join(";"));
  return BOM + lines.join("\r\n");
}

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][], headers?: string[]) {
  const csv = toCsv(rows, headers);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Formata número como pt-BR (vírgula decimal) para CSV
export function fmtNum(n: number, decimals = 2): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// Formata data ISO (yyyy-mm-dd) para dd/mm/yyyy
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}
