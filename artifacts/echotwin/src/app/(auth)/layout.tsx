export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 ambient-bg relative overflow-hidden">
      {/* Decorative glows */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 w-80 h-80 rounded-full bg-accent/8 blur-3xl" />

      <div className="w-full max-w-sm relative z-10">
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mb-4 glow-teal">
            <span className="text-2xl">💬</span>
          </div>
          <h1 className="text-3xl font-bold gradient-text tracking-tight">Bendeki Sen</h1>
          <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
            Sanki hâlâ karşındaymış gibi konuş
          </p>
        </div>

        {children}
      </div>
    </div>
  );
}
