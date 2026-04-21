import Link from "next/link";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { AppMenu } from "@/components/app/app-menu";

type InfoPageShellProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export function InfoPageShell({ eyebrow, title, subtitle, children }: InfoPageShellProps) {
  return (
    <main className="min-h-screen bg-[#0B1220] text-foreground">
      <AppMenu floating />

      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-10 pt-20">
        <div className="mb-7">
          <div className="mb-5 flex items-center justify-between">
            <Link
              href="/home"
              className="inline-flex h-9 items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 text-xs font-semibold text-white/60 transition-colors hover:border-primary/25 hover:text-primary"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Geri
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary">
              <MessageCircle className="h-3 w-3" />
              Bendeki Sen
            </div>
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary/75">
            {eyebrow}
          </p>
          <h1 className="text-[30px] font-bold leading-tight tracking-tight text-white">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/55">{subtitle}</p>
        </div>

        <section className="space-y-4">{children}</section>
      </div>
    </main>
  );
}

export function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/8 bg-white/[0.045] p-5 shadow-[0_0_40px_rgba(20,184,166,0.055)]">
      {children}
    </div>
  );
}
