"use client";

import { ChevronDown, Globe2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/context/language-context";
import { LANGUAGE_OPTIONS, type Language } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type LanguageSwitcherProps = {
  className?: string;
  compact?: boolean;
};

function FlagIcon({ language }: { language: Language }) {
  if (language === "en") {
    return (
      <span className="relative block h-4 w-6 overflow-hidden rounded-[5px] border border-white/20 bg-[repeating-linear-gradient(to_bottom,#b22234_0_2px,#ffffff_2px_4px)] shadow-[0_0_10px_rgba(255,255,255,0.08)]">
        <span className="absolute left-0 top-0 h-[9px] w-[11px] bg-[#3c3b6e]" />
        <span className="absolute left-[2px] top-[2px] h-1 w-1 rounded-full bg-white/90" />
        <span className="absolute left-[6px] top-[2px] h-1 w-1 rounded-full bg-white/75" />
        <span className="absolute left-[4px] top-[5px] h-1 w-1 rounded-full bg-white/80" />
      </span>
    );
  }

  if (language === "ja") {
    return (
      <span className="relative block h-4 w-6 overflow-hidden rounded-[5px] border border-white/20 bg-white shadow-[0_0_10px_rgba(255,255,255,0.08)]">
        <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#bc002d]" />
      </span>
    );
  }

  return (
    <span className="relative block h-4 w-6 overflow-hidden rounded-[5px] border border-white/20 bg-[#e30a17] shadow-[0_0_10px_rgba(227,10,23,0.22)]">
      <span className="absolute left-[6px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-white" />
      <span className="absolute left-[8px] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[#e30a17]" />
      <span
        className="absolute left-[14px] top-[5px] h-[6px] w-[6px] bg-white"
        style={{
          clipPath:
            "polygon(50% 0%, 61% 35%, 98% 35%, 68% 56%, 79% 91%, 50% 70%, 21% 91%, 32% 56%, 2% 35%, 39% 35%)",
        }}
      />
    </span>
  );
}

export function LanguageSwitcher({
  className,
  compact = false,
}: LanguageSwitcherProps) {
  const { language, setLanguage, t } = useI18n();
  const selected =
    LANGUAGE_OPTIONS.find((option) => option.code === language) ??
    LANGUAGE_OPTIONS[0];

  return (
    <div className={cn(compact ? "w-full" : "inline-flex", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "group flex h-11 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.065] px-3.5 text-left text-white shadow-[0_0_24px_rgba(20,184,166,0.10)] backdrop-blur-xl transition-all hover:border-primary/30 hover:bg-primary/[0.08] active:scale-[0.98]",
              compact ? "w-full" : "min-w-[178px]"
            )}
            aria-label={t("common.chooseLanguage")}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-primary/18 bg-primary/10 text-[15px]">
                <FlagIcon language={selected.code} />
              </span>
              <span className="min-w-0">
                <span className="block text-[10.5px] font-semibold uppercase tracking-[0.16em] text-primary/75">
                  {t("common.chooseLanguage")}
                </span>
                <span className="mt-0.5 block text-sm font-bold leading-none text-white/90">
                  {selected.shortLabel}
                </span>
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-white/35 transition-transform group-data-[state=open]:rotate-180 group-hover:text-primary/80" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={compact ? "start" : "center"}
          className="w-[178px] rounded-2xl border-white/10 bg-[#081322]/95 p-1.5 text-white shadow-[0_22px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
        >
          {LANGUAGE_OPTIONS.map((option) => {
            const active = option.code === language;
            return (
              <DropdownMenuItem
                key={option.code}
                onClick={() => setLanguage(option.code)}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm outline-none transition-colors focus:bg-primary/12",
                  active
                    ? "bg-primary/14 text-primary"
                    : "text-white/70 hover:bg-white/[0.06] hover:text-white"
                )}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/8 bg-white/[0.04] text-[15px]">
                  <FlagIcon language={option.code} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{option.shortLabel}</span>
                  <span className="block truncate text-[11px] text-white/38">
                    {option.nativeLabel}
                  </span>
                </span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
