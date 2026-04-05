import type { ReactNode } from "react";

type SplitSectionProps = {
  label?: string;
  title: string;
  description: string;
  bullets?: string[];
  primaryCta: {
    label: string;
    href: string;
  };
  secondaryCta?: {
    label: string;
    href: string;
  };
  right: ReactNode;
};

export default function SplitSection({
  label,
  title,
  description,
  bullets,
  primaryCta,
  secondaryCta,
  right,
}: SplitSectionProps) {
  return (
    <section className="w-full max-w-6xl px-6 py-16 sm:px-10 lg:px-12">
      <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-6">
          {label ? (
            <span className="w-fit rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
              {label}
            </span>
          ) : null}
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-black sm:text-5xl">
            {title}
          </h1>
          <p className="text-lg leading-8 text-black/70">{description}</p>
          {bullets && bullets.length > 0 ? (
            <ul className="grid gap-3 text-sm text-black/65">
              {bullets.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 flex-none rounded-full bg-black/70" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <a
              className="inline-flex h-11 items-center justify-center rounded-full bg-black px-6 text-sm font-semibold text-white transition hover:bg-black/90"
              href={primaryCta.href}
            >
              {primaryCta.label}
            </a>
            {secondaryCta ? (
              <a
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/20 px-6 text-sm font-semibold text-black transition hover:border-black/40"
                href={secondaryCta.href}
              >
                {secondaryCta.label}
              </a>
            ) : null}
          </div>
        </div>
        <div className="rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.1)]">
          {right}
        </div>
      </div>
    </section>
  );
}
