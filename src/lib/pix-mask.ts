export type PixTipo = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";

export const PIX_LABELS: Record<PixTipo, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  telefone: "Telefone",
  aleatoria: "Aleatória",
};

/**
 * Mascara dados sensíveis de Pix mantendo apenas dígitos/letras finais visíveis.
 */
export function maskPix(tipo: string | null | undefined, chave: string | null | undefined): string {
  if (!tipo || !chave) return "—";
  const v = String(chave).trim();
  if (!v) return "—";

  switch (tipo) {
    case "cpf": {
      const d = v.replace(/\D/g, "");
      if (d.length < 4) return "***";
      return `***.***.***-${d.slice(-2)}`;
    }
    case "cnpj": {
      const d = v.replace(/\D/g, "");
      if (d.length < 4) return "***";
      return `**.***.***/****-${d.slice(-2)}`;
    }
    case "email": {
      const [user, domain] = v.split("@");
      if (!domain) return `${v[0] ?? "*"}***`;
      return `${user[0] ?? "*"}***@${domain}`;
    }
    case "telefone": {
      const d = v.replace(/\D/g, "");
      if (d.length < 4) return "***";
      return `(**) *****-${d.slice(-4)}`;
    }
    case "aleatoria": {
      if (v.length <= 8) return "********";
      return `${v.slice(0, 4)}****${v.slice(-4)}`;
    }
    default:
      return "***";
  }
}
