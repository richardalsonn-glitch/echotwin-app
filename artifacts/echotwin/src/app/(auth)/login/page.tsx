"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, LogIn, Mail } from "lucide-react";
import { useI18n } from "@/context/language-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TranslationKey } from "@/lib/i18n";
import { loginAction } from "./actions";

function getErrorKey(error: string): TranslationKey | null {
  if (error === "invalid_credentials") return "auth.invalidCredentials";
  if (error === "email_not_confirmed") return "auth.emailNotConfirmed";
  return null;
}

export default function LoginPage() {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);
    setEmailNotConfirmed(false);

    startTransition(async () => {
      const result = await loginAction(formData);
      if (result?.error === "email_not_confirmed") {
        setConfirmedEmail(typeof result.email === "string" ? result.email : "");
        setEmailNotConfirmed(true);
      } else if (result?.error) {
        setError(result.error);
      }
    });
  }

  const errorKey = error ? getErrorKey(error) : null;
  const errorMessage = errorKey ? t(errorKey) : error;

  return (
    <div className="glass-card rounded-2xl p-7 shadow-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">{t("auth.welcomeTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("auth.welcomeSubtitle")}</p>
      </div>

      {errorMessage && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/10 p-3.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{errorMessage}</p>
        </div>
      )}

      {emailNotConfirmed && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3.5">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-amber-400">{t("auth.emailNotConfirmed")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{confirmedEmail}</span>{" "}
              {t("auth.emailNotConfirmedBody")}
            </p>
          </div>
        </div>
      )}

      <form action={handleSubmit} className="space-y-4">
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
            placeholder="••••••••"
            required
            autoComplete="current-password"
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
              {t("auth.loggingIn")}
            </>
          ) : (
            <>
              <LogIn className="mr-2 h-4 w-4" />
              {t("auth.login")}
            </>
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <Link href="/register" className="font-semibold text-primary transition-colors hover:text-primary/80">
          {t("auth.registerLink")}
        </Link>
      </p>
    </div>
  );
}
