"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { loginAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LogIn, Mail, AlertCircle } from "lucide-react";

export default function LoginPage() {
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
        setConfirmedEmail(result.email as string);
        setEmailNotConfirmed(true);
      } else if (result?.error) {
        setError(result.error as string);
      }
    });
  }

  return (
    <div className="glass-card rounded-2xl p-7 shadow-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">Tekrar hoş geldin</h2>
        <p className="text-muted-foreground text-sm mt-1">Seni bekliyorlar</p>
      </div>

      {error && (
        <div className="mb-5 p-3.5 rounded-xl bg-destructive/10 border border-destructive/25 flex gap-3 items-start">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {emailNotConfirmed && (
        <div className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex gap-3 items-start">
          <Mail className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-400">E-posta doğrulaması gerekiyor</p>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-foreground font-medium">{confirmedEmail}</span> adresine
              {" "}bağlantı gönderdik. Tıkla, sonra giriş yap.
            </p>
          </div>
        </div>
      )}

      <form action={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium text-foreground/80">E-posta</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="ornek@mail.com"
            required
            autoComplete="email"
            disabled={isPending}
            className="bg-input/50 border-border/60 rounded-xl h-11 focus:border-primary/60 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium text-foreground/80">Şifre</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            autoComplete="current-password"
            disabled={isPending}
            className="bg-input/50 border-border/60 rounded-xl h-11 focus:border-primary/60 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
          />
        </div>

        <Button
          type="submit"
          className="w-full h-11 rounded-xl font-semibold text-sm mt-2 bg-primary text-primary-foreground hover:bg-primary/90 glow-teal transition-all"
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Giriş yapılıyor...
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4 mr-2" />
              Giriş Yap
            </>
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        Hesabın yok mu?{" "}
        <Link href="/register" className="text-primary font-semibold hover:text-primary/80 transition-colors">
          Kayıt ol
        </Link>
      </p>
    </div>
  );
}
