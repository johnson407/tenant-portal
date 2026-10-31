import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  caption?: ReactNode;
  children: ReactNode;
};

export default function SectionCard({ title, caption, children }: SectionCardProps) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-slate-100">
      <h2 className="text-xl font-semibold">{title}</h2>
      {caption ? <p className="mt-1 text-sm text-slate-400">{caption}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}
