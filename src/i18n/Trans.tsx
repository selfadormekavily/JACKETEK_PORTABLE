import type { TKey } from "@/i18n/context";
import { renderRich, type TagRender } from "@/i18n/richText";
import type { Vars } from "@/i18n/types";
import { useI18n } from "@/i18n/useI18n";

/**
 * Rich text from a message: "<em>a moment</em> worth keeping" with
 * `tags={{ em: (c) => <em className="…">{c}</em> }}`. Tags are the
 * translator's markers for spans the design styles differently (accent
 * colour, a second line), never raw HTML. Unknown tags render their text.
 */
export function Trans({ k, vars, tags = {} }: { k: TKey; vars?: Vars; tags?: Record<string, TagRender> }) {
  const { t } = useI18n();
  return <>{renderRich(t(k, vars), tags)}</>;
}
