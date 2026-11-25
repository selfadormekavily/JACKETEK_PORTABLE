import type { JacketConfig } from "@/features/configurator/model/types";

/**
 * Development tech pack of the live design (server/techpack/routes.mjs). Admin only: the request
 * carries the admin session cookie (HttpOnly) and the admin marker header; the server refuses
 * anyone else. The design is sent exactly as the configurator holds it.
 */
export type DevTechPackResult = {
  designId: string;
  revision: string;
  size: string;
  pages: number;
  artwork: number;
  pdfUrl: string;
  packageRef: string;
  qa: { designToSpec: { ok: boolean; checks: number }; specToDrawing: { ok: boolean; checks: number } };
};

export class DevTechPackError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly issues: { code?: string; path?: string; message: string }[] = []
  ) {
    super(message);
  }
}

export async function generateDevTechPack(config: JacketConfig): Promise<DevTechPackResult> {
  const res = await fetch("/api/admin/techpack/development", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Jacketek-Admin": "1" },
    body: JSON.stringify({ config }),
  });
  const body = (await res.json().catch(() => null)) as (DevTechPackResult & { error?: string; issues?: DevTechPackError["issues"] }) | null;
  if (!res.ok || !body) throw new DevTechPackError(body?.error ?? `Generation failed (${res.status}).`, res.status, body?.issues ?? []);
  return body;
}
