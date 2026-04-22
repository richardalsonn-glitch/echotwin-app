import { AppMenu } from "@/components/app/app-menu";
import { AuthBrand } from "@/components/app/auth-brand";
import { LanguageSwitcher } from "@/components/app/language-switcher";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ambient-bg relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <AppMenu floating />
      <LanguageSwitcher className="fixed right-4 top-4 z-40" />

      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-accent/8 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm">
        <AuthBrand />
        {children}
      </div>
    </div>
  );
}

