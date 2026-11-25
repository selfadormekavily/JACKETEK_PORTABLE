import type { ReactNode } from "react";

/**
 * Left-to-right island inside Arabic text: emails, phone numbers, order
 * ids, sizes, codes, URLs, Latin embroidery. <bdi dir="ltr"> isolates it
 * so neighbouring punctuation and words never reorder around it.
 */
export default function Ltr({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={className}>
      {children}
    </bdi>
  );
}
