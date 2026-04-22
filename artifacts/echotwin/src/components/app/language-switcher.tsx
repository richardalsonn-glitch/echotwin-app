"use client";

import { Globe2 } from "lucide-react";
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

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.065] p-1 text-white shadow-[0_0_22px_rgba(20,184,166,0.08)] backdrop-blur-xl",
        compact ? "w-full justify-between rounded-2xl" : "",
        className
      )}
      aria-label={t("common.language")}
    >
      {!compact && <Globe2 className="ml-2 h-3.5 w-3.5 text-primary/80" />}
      {LANGUAGE_OPTIONS.map((option) => {
        const active = option.code === language;
        return (
          <button
            key={option.code}
            type="button"
            onClick={() => setLanguage(option.code)}
            className={cn(
              "min-w-9 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition-all active:scale-95",
              active
                ? "bg-primary text-primary-foreground shadow-[0_0_18px_rgba(20,184,166,0.28)]"
                : "text-white/55 hover:bg-white/[0.06] hover:text-white/85",
              compact && "flex-1"
            )}
            aria-pressed={active}
            title={option.nativeLabel}
          >
            {option.shortLabel}
          </button>
        );
      })}
    </div>
  );
}

