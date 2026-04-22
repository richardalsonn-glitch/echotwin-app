"use client";

import { MessageCircle } from "lucide-react";
import { useI18n } from "@/context/language-context";

export function AuthBrand() {
  const { t } = useI18n();

  return (
    <div className="mb-10 text-center">
      <div className="glow-teal mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
        <MessageCircle className="h-7 w-7 text-primary" />
      </div>
      <h1 className="gradient-text text-3xl font-bold tracking-tight">
        {t("common.appName")}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {t("auth.tagline")}
      </p>
    </div>
  );
}

