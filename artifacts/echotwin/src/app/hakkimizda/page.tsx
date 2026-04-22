"use client";

import { InfoCard, InfoPageShell } from "@/components/app/info-page-shell";
import { useI18n } from "@/context/language-context";
import type { TranslationKey } from "@/lib/i18n";

const HIGHLIGHTS: TranslationKey[] = [
  "info.highlight.0",
  "info.highlight.1",
  "info.highlight.2",
  "info.highlight.3",
];

export default function AboutPage() {
  const { t } = useI18n();

  return (
    <InfoPageShell
      eyebrow={t("info.aboutEyebrow")}
      title={t("info.aboutTitle")}
      subtitle={t("info.aboutSubtitle")}
    >
      <InfoCard>
        <div className="space-y-4 text-sm leading-relaxed text-white/62">
          <p>{t("info.aboutBody1")}</p>
          <p>{t("info.aboutBody2")}</p>
          <p>{t("info.aboutBody3")}</p>
        </div>
      </InfoCard>

      <div className="grid grid-cols-1 gap-3">
        {HIGHLIGHTS.map((key) => (
          <div
            key={key}
            className="rounded-2xl border border-primary/15 bg-primary/[0.07] px-4 py-3 text-sm font-medium text-white/78"
          >
            {t(key)}
          </div>
        ))}
      </div>
    </InfoPageShell>
  );
}

