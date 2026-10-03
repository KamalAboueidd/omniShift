import { Zap, HardDrive } from 'lucide-react';

export const Hero = () => {
  return (
    <section className="relative pt-8 pb-6 text-center sm:pt-14 sm:pb-8">
      {/* Main Headline */}
      <h1 className="mx-auto max-w-3xl text-3xl font-bold tracking-[-0.035em] text-[var(--text-primary)] sm:text-5xl sm:leading-[1.1]">
        Client-Side Transmutation at Bare-Metal Speed.
      </h1>

      {/* Subtitle */}
      <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[var(--text-muted)] sm:text-base">
        Convert, compress, and transmute media and documents directly in your browser&apos;s memory. Zero telemetry, zero cloud upload.
      </p>

      {/* Quick Specs / Capabilities Row */}
      <div className="mx-auto mt-6 flex max-w-lg items-center justify-center gap-6 border-y border-[var(--border-subtle)] py-2.5 text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <Zap className="h-3 w-3 text-[#FF5A1F]" strokeWidth={1.25} />
          <span>WASM &amp; Web Workers</span>
        </div>
        <div className="h-3 w-[1px] bg-[var(--border-color)]" />
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <HardDrive className="h-3 w-3 text-[var(--text-primary)]" strokeWidth={1.25} />
          <span>In-Memory RAM Pipeline</span>
        </div>
        <div className="h-3 w-[1px] bg-[var(--border-color)]" />
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <span className="text-[#FF5A1F] font-semibold">60 FPS</span>
          <span>Preserved Main Thread</span>
        </div>
      </div>
    </section>
  );
};
