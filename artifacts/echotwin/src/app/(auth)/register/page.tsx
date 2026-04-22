"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2, UserPlus } from "lucide-react";
import { useI18n } from "@/context/language-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TranslationKey } from "@/lib/i18n";
import { registerAction } from "./actions";

function getErrorKey(error: string): TranslationKey | null {
  if (error === "email_already_registered") return "auth.emailAlreadyRegistered";
  return null;
}

export default function RegisterPage() {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);

    startTransition(async () => {
      const result = await registerAction(formData);
      if (result?.error) {
        setError(result.error);
      } else if (result?.emailSent) {
        setSentEmail(typeof result.email === "string" ? result.email : "");
        setEmailSent(true);
      }
    });
  }

  const errorKey = error ? getErrorKey(error) : null;
  const errorMessage = errorKey ? t(errorKey) : error;

  if (emailSent) {
    return (
      <div className="glass-card space-y-5 rounded-2xl p-8 text-center shadow-2xl">
        <div className="flex items-center justify-center">
          <div className="glow-teal flex h-16 w-16 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold">{t("auth.emailSentTitle")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">{sentEmail}</span>{" "}
            {t("auth.emailSentBody")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{t("auth.emailSentHint")}</p>
        </div>
        <Link href="/login">
          <Button
            variant="outline"
            className="h-11 w-full rounded-xl border-border/60 transition-all hover:border-primary/40 hover:bg-primary/5"
          >
            {t("auth.login")}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-7 shadow-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">{t("auth.createTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("auth.createSubtitle")}</p>
      </div>

      {errorMessage && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/10 p-3.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{errorMessage}</p>
        </div>
      )}

      <form action={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-sm font-medium text-foreground/80">
            {t("auth.name")}
          </Label>
          <Input
            id="name"
            name="displayName"
            type="text"
            placeholder={t("auth.namePlaceholder")}
            required
            disabled={isPending}
            className="h-11 rounded-xl border-border/60 bg-input/50 transition-all placeholder:text-muted-foreground/50 focus:border-primary/60 focus:ring-primary/20"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium text-foreground/80">
            {t("auth.email")}
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="@mail.com"
            required
            autoComplete="email"
            disabled={isPending}
            className="h-11 rounded-xl border-border/60 bg-input/50 transition-all placeholder:text-muted-foreground/50 focus:border-primary/60 focus:ring-primary/20"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium text-foreground/80">
            {t("auth.password")}
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder={t("auth.passwordPlaceholder")}
            required
            autoComplete="new-password"
            minLength={6}
            disabled={isPending}
            className="h-11 rounded-xl border-border/60 bg-input/50 transition-all placeholder:text-muted-foreground/50 focus:border-primary/60 focus:ring-primary/20"
          />
        </div>

        <Button
          type="submit"
          className="glow-teal mt-2 h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90"
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("auth.registering")}
            </>
          ) : (
            <>
              <UserPlus className="mr-2 h-4 w-4" />
              {t("auth.register")}
            </>
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("auth.hasAccount")}{" "}
        <Link href="/login" className="font-semibold text-primary transition-colors hover:text-primary/80">
          {t("auth.loginLink")}
        </Link>
      </p>

      <p className="mt-3 text-center text-xs text-muted-foreground/60">
        {t("auth.termsPrefix")}{" "}
        <span className="text-muted-foreground">{t("auth.terms")}</span>{" "}
        {t("auth.and")}{" "}
        <span className="text-muted-foreground">{t("auth.privacy")}</span>{" "}
        {t("auth.termsSuffix")}
      </p>
    </div>
  );
}
