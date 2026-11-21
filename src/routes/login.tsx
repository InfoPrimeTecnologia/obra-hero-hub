import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Logo } from "@/components/Logo";
import loginHero from "@/assets/login-construction.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { resendConfirmation, requestMagicLink, signupWithEmail } from "@/lib/auth-email.functions";
import { trackAccountCreated } from "@/lib/meta-pixel";

const REMEMBER_KEY = "mestre360.remember";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [
    { title: "Entrar ou criar conta — Mestre 360" },
    { name: "description", content: "Acesse sua conta ou cadastre-se no Mestre 360 para gerenciar suas obras." },
    { property: "og:title", content: "Entrar ou criar conta — Mestre 360" },
    { property: "og:description", content: "Cadastro e acesso à plataforma de gestão de obras Mestre 360." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  validateSearch: (search: Record<string, unknown>): { aba?: string; tab?: string } => ({
    ...(typeof search.aba === "string" ? { aba: search.aba } : {}),
    ...(typeof search.tab === "string" ? { tab: search.tab } : {}),
  }),
  component: LoginPage,
});

const SIGNUP_VALUES = ["criar", "cadastro", "signup", "cadastrar"];

function LoginPage() {
  const { signIn, user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const resendFn = useServerFn(resendConfirmation);
  const magicLinkFn = useServerFn(requestMagicLink);
  const signupFn = useServerFn(signupWithEmail);
  const [loading, setLoading] = useState(false);
  const [justLoggedIn, setJustLoggedIn] = useState(false);
  const search = Route.useSearch();
  const wantsSignup = SIGNUP_VALUES.includes((search.aba ?? search.tab ?? "").toLowerCase());
  const [tab, setTab] = useState<"login" | "signup">(wantsSignup ? "signup" : "login");
  useEffect(() => { if (wantsSignup) setTab("signup"); }, [wantsSignup]);

  useEffect(() => {
    if (authLoading || !user) return;
    navigate({ to: isAdmin ? "/admin" : "/app" });
  }, [justLoggedIn, authLoading, user, isAdmin, navigate]);



  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [remember, setRemember] = useState(true);


  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.email) setLoginEmail(parsed.email);
        setRemember(true);
      }
    } catch { /* ignore */ }
  }, []);


  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupSent, setSignupSent] = useState(false);

  const passwordChecks = {
    length: signupPassword.length >= 8,
    upper: /[A-Z]/.test(signupPassword),
    lower: /[a-z]/.test(signupPassword),
    number: /[0-9]/.test(signupPassword),
    special: /[^A-Za-z0-9]/.test(signupPassword),
  };

  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resending, setResending] = useState(false);
  const [sendingMagic, setSendingMagic] = useState(false);

  const handleResendConfirmation = async (email = loginEmail) => {
    if (!email) {
      toast.error("Informe seu e-mail acima");
      return;
    }
    setResending(true);
    try {
      const r = await resendFn({ data: { email, origin: window.location.origin } });
      if (r.ok) toast.success("E-mail de confirmação enviado!");
      else toast.error(r.error);
    } catch (e: any) {
      toast.error("Falha ao reenviar", { description: e?.message });
    } finally {
      setResending(false);
    }
  };

  const handleMagicLink = async () => {
    if (!loginEmail) {
      toast.error("Informe seu e-mail acima");
      return;
    }
    setSendingMagic(true);
    try {
      await magicLinkFn({ data: { email: loginEmail, origin: window.location.origin } });
      toast.success("Se este e-mail existir, enviamos um link de acesso.");
    } catch (e: any) {
      toast.error("Falha ao enviar magic link", { description: e?.message });
    } finally {
      setSendingMagic(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNeedsConfirm(false);
    const { error } = await signIn(loginEmail, loginPassword);
    setLoading(false);
    if (error) {
      const msg = (error.message ?? "").toLowerCase();
      const code = ((error as { code?: string }).code ?? "").toLowerCase();
      if (
        code.includes("email_not_confirmed") ||
        msg.includes("not confirmed") ||
        msg.includes("não confirmado") ||
        msg.includes("nao confirmado") ||
        msg.includes("confirm")
      ) {
        setNeedsConfirm(true);
      }
      toast.error("Falha no login", { description: error.message });
    } else {
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email: loginEmail }));
        else localStorage.removeItem(REMEMBER_KEY);
      } catch { /* ignore */ }

      toast.success("Bem-vindo de volta!");
      setJustLoggedIn(true);
    }
  };


  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    if (!passwordChecks.length) {
      toast.error("A senha precisa ter pelo menos 8 caracteres");
      return;
    }
    setLoading(true);
    try {
      const r = await signupFn({
        data: {
          email: signupEmail,
          password: signupPassword,
          fullName: signupName,
          companyName: null,
          cpfCnpj: null,
          origin: window.location.origin,
        },
      });
      if (r.ok) {
        toast.success("Conta criada! Verifique seu e-mail para confirmar.");
        setSignupSent(true);
        if (r.accountCreated) void trackAccountCreated(crypto.randomUUID()).catch(() => { /* Ads must never block signup. */ });
      } else {
        toast.error("Falha no cadastro", { description: r.error });
      }
    } catch (err: any) {
      toast.error("Falha no cadastro", { description: err?.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <img
          src={loginHero}
          alt="Engenheiro civil em obra com pranchas técnicas e guindastes ao fundo"
          className="absolute inset-0 h-full w-full object-cover"
          width={1024}
          height={1280}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/70 via-primary/40 to-background/30" />
        <div className="relative z-10 flex h-full flex-col justify-end p-10 text-primary-foreground">
          <div className="space-y-3">
            <h2 className="text-3xl font-bold leading-tight drop-shadow-md">
              Gestão 360° da sua obra
            </h2>
            <p className="max-w-sm text-base text-primary-foreground/90 drop-shadow">
              Controle clientes, planos, faturas e tickets em um único painel feito para a construção civil.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/10 p-4 py-8">
        <div className="w-full max-w-md space-y-6">
          <div className="flex justify-center">
            <Logo className="h-24" />
          </div>
          <Card className="border-border shadow-lg">
            <CardHeader>
              <CardTitle>{tab === "signup" ? "Teste 5 dias grátis" : "Bem-vindo ao Mestre 360"}</CardTitle>
              <CardDescription>{tab === "signup" ? "Crie sua conta em 30 segundos. Sem cartão de crédito." : "Entre na sua conta"}</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Entrar</TabsTrigger>
                  <TabsTrigger value="signup">Criar conta</TabsTrigger>
                </TabsList>
                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">E-mail</Label>
                      <Input
                        id="login-email"
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Senha</Label>
                      <Input
                        id="login-password"
                        type="password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="remember-me"
                        checked={remember}
                        onCheckedChange={(v) => setRemember(v === true)}
                      />
                      <Label htmlFor="remember-me" className="cursor-pointer text-sm font-normal">
                        Lembrar meu e-mail neste dispositivo
                      </Label>

                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Entrando..." : "Entrar"}
                    </Button>
                    <div className="flex items-center justify-between text-xs">
                      <Link to="/auth/forgot-password" className="text-primary hover:underline">
                        Esqueci minha senha
                      </Link>
                      <button
                        type="button"
                        onClick={handleMagicLink}
                        disabled={sendingMagic}
                        className="text-primary hover:underline disabled:opacity-50"
                      >
                        {sendingMagic ? "Enviando..." : "Entrar com magic link"}
                      </button>

                    </div>
                    {needsConfirm && (
                      <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                        <p className="mb-2 text-muted-foreground">
                          Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada ou reenvie o e-mail de confirmação.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => handleResendConfirmation()}
                          disabled={resending || !loginEmail}
                        >
                          {resending ? "Reenviando..." : "Reenviar e-mail de confirmação"}
                        </Button>
                      </div>
                    )}
                  </form>
                </TabsContent>
                <TabsContent value="signup">
                  {signupSent ? (
                    <div className="space-y-4 pt-4">
                      <div className="rounded-md border border-border bg-muted/40 p-4 text-sm">
                        <p className="font-medium mb-2">✉️ Verifique seu e-mail</p>
                        <p className="text-muted-foreground">
                          Enviamos um link de confirmação para <strong>{signupEmail}</strong>. Clique no link para ativar sua conta.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => { setSignupSent(false); setTab("login"); }}
                      >
                        Ir para o login
                      </Button>
                      <Button
                        type="button"
                        className="w-full"
                        onClick={() => handleResendConfirmation(signupEmail)}
                        disabled={resending || !signupEmail}
                      >
                        {resending ? "Reenviando..." : "Reenviar e-mail de confirmação"}
                      </Button>
                    </div>
                  ) : (
                  <form onSubmit={handleSignup} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Seu nome</Label>
                      <Input
                        id="signup-name"
                        required
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">E-mail</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        required
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Senha</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        required
                        minLength={8}
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Criando conta..." : "Começar teste grátis"}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      Já tem uma conta?{" "}
                      <button
                        type="button"
                        onClick={() => setTab("login")}
                        className="font-medium text-primary hover:underline"
                      >
                        Entrar
                      </button>
                    </p>
                  </form>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
