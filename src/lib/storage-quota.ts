import { supabase } from "@/integrations/supabase/client";

export type StorageQuota = { used_bytes: number; limit_bytes: number | null };

export async function getStorageQuota(): Promise<StorageQuota> {
  const { data, error } = await supabase.rpc("my_storage_quota");
  if (error) throw new Error(`Não foi possível consultar o armazenamento: ${error.message}`);
  const quota = Array.isArray(data) ? data[0] : data;
  if (!quota) throw new Error("Não foi possível identificar o armazenamento da empresa.");
  return { used_bytes: Number(quota.used_bytes), limit_bytes: quota.limit_bytes == null ? null : Number(quota.limit_bytes) };
}

export async function assertStorageAvailable(bytes: number): Promise<void> {
  const quota = await getStorageQuota();
  if (quota.limit_bytes !== null && quota.used_bytes + bytes > quota.limit_bytes) {
    throw new Error("Armazenamento do plano esgotado. Libere espaço ou aumente a capacidade do plano.");
  }
}

export function formatStorage(bytes: number): string {
  if (bytes < 1048576) return `${(bytes / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
  return `${(bytes / 1073741824).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} GB`;
}