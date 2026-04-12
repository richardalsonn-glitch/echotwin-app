"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { registerAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UserPlus, Mail, AlertCircle, CheckCircle2 } from "lucide-react";

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);

    startTransition(async () => {
      const result = await registerAction(formData);
      if (result?.error) {
        setError(result.error as string);
      } else if (result?.emailSent) {
        setSentEmail(result.email as string);
        setEmailSent(true);
      }
    });
  }

  if (emailSent) {
    return (
      <div className="glass-card rounded-2xl p-8 shadow-2xl text-center space-y-5">
        <div className="flex items-center justify-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center glow-teal">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold">E-postanı kontrol et</h2>
          <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
            <span className="text-foreground font-semibold">{sentEmail}</span> adresine
            {" "}bir doğrulama bağlantısı gönderdik.
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            Bağlantıya tıkladıktan sonra giriş yapabilirsin.
          </p>
        </div>
        <Link href="/login">
          <Button variant="outline" className="w-full rounded-xl h-11 border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all">
            Giriş Yap
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-7 shadow-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">Hesap Oluştur</h2>
        <p className="text-muted-foreground text-sm mt-1">Ücretsiz katıl, ilk profilini oluştur</p>
      </div>

      {error && (
        <div className="mb-5 p-3.5 rounded-xl bg-destructive/10 border border-destructive/25 flex gap-3 items-start">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <form action={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-sm font-medium text-foreground/80">Adın</Label>
          <Input
            id="name"
            name="displayName"
            type="text"
            placeholder="Adın Soyadın"
            required
            disabled={isPending}
            className="bg-input/50 border-border/60 rounded-xl h-11 focus:border-primary/60 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
          />
        </div>

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
            placeholder="En az 6 karakter"
            required
            autoComplete="new-password"
            minLength={6}
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
              Hesap oluşturuluyor...
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4 mr-2" />
              Kayıt Ol
            </>
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        Zaten hesabın var mı?{" "}
        <Link href="/login" className="text-primary font-semibold hover:text-primary/80 transition-colors">
          Giriş yap
        </Link>
      </p>

      <p className="text-center text-xs text-muted-foreground/60 mt-3">
        Kayıt olarak{" "}
        <span className="text-muted-foreground">Kullanım Şartları</span>
        {" "}ve{" "}
        <span className="text-muted-foreground">Gizlilik Politikası</span>&apos;nı
        {" "}kabul etmiş olursun.
      </p>
    </div>
  );
}
