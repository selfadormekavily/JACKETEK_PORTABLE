import { ROUTES } from "@/lib/routes";

/**
 * Where auth may send the customer back to. Only these internal paths are
 * accepted (no protocol, host, "//" or backslash tricks), so ?returnTo can
 * never become an open redirect.
 */
const ALLOWED = [ROUTES.home, ROUTES.design, ROUTES.cart, ROUTES.checkout, ROUTES.groups] as const;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** Group pages: an invitation (/join/<token>) or one group (/groups/<id>). */
const GROUP_PATHS = [new RegExp(`^${ROUTES.join}/[A-Za-z0-9_-]{43}$`), new RegExp(`^${ROUTES.groups}/${UUID}$`)];
const ID = new RegExp(`^${UUID}$`);

/** /design keeps only a group target (?group=<id>[&item=<id>]); any other query is dropped. */
function designQuery(params: URLSearchParams): string {
  const group = params.get("group");
  const item = params.get("item");
  if (!group || !ID.test(group)) return "";
  return item && ID.test(item) ? `?group=${group}&item=${item}` : `?group=${group}`;
}

export function safeReturnTo(raw: string | null | undefined): string {
  if (!raw || raw.length > 200) return ROUTES.home;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || [...raw].some((ch) => ch.charCodeAt(0) < 0x20)) return ROUTES.home;
  let url: URL;
  try {
    // Resolve against a dummy origin: anything that escapes it is rejected.
    url = new URL(raw, "https://jacketek.invalid");
    if (url.origin !== "https://jacketek.invalid") return ROUTES.home;
  } catch {
    return ROUTES.home;
  }
  const path = url.pathname;
  if (path === ROUTES.design) return `${path}${designQuery(url.searchParams)}`;
  if (GROUP_PATHS.some((p) => p.test(path))) return path;
  return (ALLOWED as readonly string[]).includes(path) ? path : ROUTES.home;
}

/** The auth page URL for a flow that should come back to `returnTo` afterwards. */
export function authUrl(returnTo: string, intent?: "add-to-cart"): string {
  const params = new URLSearchParams({ returnTo });
  if (intent) params.set("intent", intent);
  return `${ROUTES.auth}?${params}`;
}
