import type { JacketConfig } from "@/features/configurator";
import type { GroupView, InvitePreview, JacketPayload, MyGroup, OwnGroupJacket } from "./types";

/**
 * The group orders API (server/groupRoutes.mjs). The session is the
 * HttpOnly cookie; changes carry the site's own header (CSRF), as the
 * account API does.
 */

/**
 * A failed request. `code` is the server's stable reason ("GROUP_NOT_OPEN",
 * "VERSION_CONFLICT"…) the UI words in the customer's language
 * (features/groups/errors.ts); status 0 / code NETWORK = unreachable.
 */
export class GroupApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

/** Previews in the personal cart can be large; the server takes up to 2 MB (sent as ~2.7M characters). */
const MAX_PREVIEW_CHARS = 2_700_000;
/** A preview the server will take (an image data URL, small enough), or none — it's display-only and never blocks a jacket. */
const PREVIEW = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
export const sendablePreview = (preview: string | null) =>
  preview && preview.length <= MAX_PREVIEW_CHARS && PREVIEW.test(preview) ? preview : null;

/** A failure the server didn't name (e.g. a crash, or a proxy in between): named by its HTTP status. */
const codeForStatus = (status: number) =>
  status === 413 ? "PAYLOAD_TOO_LARGE" : status === 401 ? "UNAUTHENTICATED" : status === 404 ? "NOT_FOUND" : status === 429 ? "RATE_LIMITED" : status >= 500 ? "SERVER_ERROR" : "UNKNOWN";

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: method === "GET" ? {} : { "Content-Type": "application/json", "X-Jacketek-Auth": "1" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new GroupApiError("We couldn't reach JACKETEK.", 0, "NETWORK");
  }
  if (res.status === 304) return null as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const { error, code, ...details } = data ?? {};
    throw new GroupApiError(error ?? "Something went wrong.", res.status, code ?? codeForStatus(res.status), details);
  }
  return data as T;
}

const g = (id: string) => `/api/groups/${encodeURIComponent(id)}`;

export const groupsApi = {
  mine: () => call<{ groups: MyGroup[] }>("GET", "/api/groups"),
  create: (input: { name: string | null; clientRequestId: string }) => call<GroupView & { replayed: boolean }>("POST", "/api/groups", input),
  /** null = unchanged since `since` (304). */
  get: (id: string, since?: number) => call<GroupView | null>("GET", since === undefined ? g(id) : `${g(id)}?since=${since}`),
  rename: (id: string, name: string | null) => call<{ revision: number }>("PATCH", g(id), { name }),
  setStatus: (id: string, to: "LOCKED" | "OPEN" | "CANCELLED", expectedRevision: number) =>
    call<{ status: string; revision: number }>("POST", `${g(id)}/status`, { to, expectedRevision }),
  rotateInvite: (id: string) => call<{ invite: { path: string }; revision: number }>("POST", `${g(id)}/invite/rotate`),
  transferHost: (id: string, memberId: string, expectedRevision: number) => call<{ revision: number }>("POST", `${g(id)}/host`, { memberId, expectedRevision }),
  leave: (id: string) => call<{ left: true }>("POST", `${g(id)}/leave`),
  removeMember: (id: string, memberId: string, expectedRevision: number) =>
    call<{ removed: true }>("DELETE", `${g(id)}/members/${encodeURIComponent(memberId)}?expectedRevision=${expectedRevision}`),

  invite: (token: string) => call<{ invite: InvitePreview }>("GET", `/api/groups/invite/${encodeURIComponent(token)}`),
  join: (token: string) => call<{ groupId: string; memberId: string; joined: boolean }>("POST", `/api/groups/invite/${encodeURIComponent(token)}/join`),

  addJacket: (id: string, jacket: JacketPayload) =>
    call<{ item: OwnGroupJacket; replayed: boolean; revision: number }>("POST", `${g(id)}/items`, { ...jacket, preview: sendablePreview(jacket.preview) }),
  importJackets: (id: string, jackets: JacketPayload[]) =>
    call<{ items: { clientRequestId: string; status: "created" | "replayed"; item: OwnGroupJacket }[]; revision: number }>("POST", `${g(id)}/items/import`, {
      items: jackets.map((j) => ({ ...j, preview: sendablePreview(j.preview) })),
    }),
  myJackets: (id: string) => call<{ items: OwnGroupJacket[] }>("GET", `${g(id)}/my-items`),
  jacket: (id: string, itemId: string) => call<{ item: OwnGroupJacket }>("GET", `${g(id)}/items/${encodeURIComponent(itemId)}`),
  updateJacket: (id: string, itemId: string, change: { quantity?: number; size?: string; expectedVersion: number }) =>
    call<{ item: OwnGroupJacket; revision: number }>("PATCH", `${g(id)}/items/${encodeURIComponent(itemId)}`, change),
  /** Without a new still (none could be taken), the jacket keeps its current preview. */
  replaceJacket: (id: string, itemId: string, design: { config: JacketConfig; preview: string | null; expectedVersion: number }) => {
    const preview = sendablePreview(design.preview);
    return call<{ item: OwnGroupJacket; revision: number }>("PUT", `${g(id)}/items/${encodeURIComponent(itemId)}`, {
      config: design.config,
      expectedVersion: design.expectedVersion,
      ...(preview ? { preview } : {}),
    });
  },
  removeJacket: (id: string, itemId: string, expectedVersion: number) =>
    call<{ item: OwnGroupJacket }>("DELETE", `${g(id)}/items/${encodeURIComponent(itemId)}?expectedVersion=${expectedVersion}`),
};

export const newRequestId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? `req-${crypto.randomUUID()}` : `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/** Group ids are UUIDs (anything else is not a group link). */
export const isGroupId = (v: string | null | undefined): v is string => !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
export const isInviteToken = (v: string | null | undefined): v is string => !!v && /^[A-Za-z0-9_-]{43}$/.test(v);
