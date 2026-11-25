import { Fragment, type ReactNode } from "react";

export type TagRender = (children: ReactNode) => ReactNode;

/** Parses "<tag>…</tag>" / "<tag/>" markers in a message into React nodes. */
const TAG = /<(\w+)>([\s\S]*?)<\/\1>|<(\w+)\s*\/>/g;

export function renderRich(text: string, tags: Record<string, TagRender>): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(TAG)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const name = m[1] ?? m[3];
    const inner = m[2] ?? "";
    const render = tags[name];
    if (m[3]) out.push(render ? <Fragment key={i++}>{render(null)}</Fragment> : name === "br" ? <br key={i++} /> : null);
    else out.push(<Fragment key={i++}>{render ? render(renderRich(inner, tags)) : renderRich(inner, tags)}</Fragment>);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
