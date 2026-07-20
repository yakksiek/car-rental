// core
import * as React from "react";

// others
import { cn } from "../../lib/utils";

// The numbered-section layout primitives shared by both protocol forms (S-05
// issue + S-06 return): a numbered head (index chip + title + sub, optional
// aside) and the card/shell wrapper. Extracted from `ProtocolForm` in S-06 Phase
// 5 so the two forms cannot drift on section chrome. Presentational only — no
// state, no storage, safe on either side of the SSR boundary.

/** The `text-[11px]` field-label class the condition inputs share. */
export const LABEL_CLASS = "text-muted-foreground text-[11px] font-[650] tracking-[0.01em]";

export function SectionHead({
  n,
  title,
  sub,
  aside,
}: {
  n: number;
  title: string;
  sub: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <span className="bg-foreground text-background flex size-6 shrink-0 items-center justify-center rounded-[8px] font-mono text-[12px] font-bold">
          {n}
        </span>
        <div>
          <h2 className="text-foreground text-[15px] font-bold tracking-tight">{title}</h2>
          <p className="text-muted-foreground mt-0.5 text-[12px]">{sub}</p>
        </div>
      </div>
      {aside}
    </div>
  );
}

export function Section({
  n,
  title,
  sub,
  aside,
  card = true,
  className,
  children,
}: {
  n: number;
  title: string;
  sub: string;
  aside?: React.ReactNode;
  card?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn("rounded-[18px] p-5 sm:p-[22px]", card && "border-border bg-card shadow-card border", className)}
    >
      <SectionHead n={n} title={title} sub={sub} aside={aside} />
      {children}
    </section>
  );
}
