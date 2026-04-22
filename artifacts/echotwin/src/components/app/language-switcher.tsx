"use client";

import { ChevronDown, Globe2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/context/language-context";
import { LANGUAGE_OPTIONS } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type LanguageSwitcherProps = {
  className?: string;
  compact?: boolean;
};

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
                {selected.flag}
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
                  {option.flag}
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

