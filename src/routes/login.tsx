import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Logo } from "@/components/Logo";
import loginHero from "@/assets/login-construction.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"login" | "signup">("login");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [signupName, setSignupName] = useState("");
  const [signupCompany, setSignupCompany] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupCpfCnpj, setSignupCpfCnpj] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");

  const passwordChecks = {
    length: signupPassword.length >= 8,
    upper: /[A-Z]/.test(signupPassword),
    lower: /[a-z]/.test(signupPassword),
    number: /[0-9]/.test(signupPassword),
    special: /[^A-Za-z0-9]/.test(signupPassword),
    match: signupPassword.length > 0 && signupPassword === signupConfirm,
  };

  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resending, setResending] = useState(false);

  const handleResendConfirmation = async () => {
    if (!loginEmail) {
      toast.error("Informe seu e-mail acima");
      return;
    }
    setResending(true);
    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: loginEmail,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setResending(false);
    if (error) {
      toast.error("Não foi possível reenviar", { description: error.message });
    } else {
      toast.success("E-mail de confirmação reenviado!");
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNeedsConfirm(false);
    const { error } = await signIn(loginEmail, loginPassword);
    setLoading(false);
    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("not confirmed") || msg.includes("confirm")) {
        setNeedsConfirm(true);
      }
      toast.error("Falha no login", { description: error.message });
    } else {
      toast.success("Bem-vindo de volta!");
      // O redirecionamento por papel é feito na rota /admin e /app
      navigate({ to: "/admin" });
    }
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    if (signupPassword !== signupConfirm) {
      toast.error("As senhas não conferem");
      return;
    }
    if (!passwordChecks.length || !passwordChecks.upper || !passwordChecks.lower || !passwordChecks.number) {
      toast.error("A senha não atende aos requisitos mínimos");
      return;
    }
    setLoading(true);
    const { error } = await signUp({
      email: signupEmail,
      password: signupPassword,
      fullName: signupName,
      companyName: signupCompany || undefined,
      cpfCnpj: signupCpfCnpj || undefined,
    });
    setLoading(false);
    if (error) {
      toast.error("Falha no cadastro", { description: error.message });
    } else {
      toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      setTab("login");
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
              <CardTitle>Bem-vindo ao Mestre 360</CardTitle>
              <CardDescription>Acesse sua conta ou cadastre sua empresa</CardDescription>
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
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Entrando..." : "Entrar"}
                    </Button>
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
                          onClick={handleResendConfirmation}
                          disabled={resending}
                        >
                          {resending ? "Reenviando..." : "Reenviar e-mail de confirmação"}
                        </Button>
                      </div>
                    )}
                  </form>
                </TabsContent>
                <TabsContent value="signup">
                  <form onSubmit={handleSignup} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Nome *</Label>
                      <Input
                        id="signup-name"
                        required
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-company">Nome da Empresa</Label>
                      <Input
                        id="signup-company"
                        value={signupCompany}
                        onChange={(e) => setSignupCompany(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">E-mail *</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        required
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Este será o e-mail de acesso (login) do administrador principal da conta.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-cpf">CPF / CNPJ</Label>
                      <Input
                        id="signup-cpf"
                        value={signupCpfCnpj}
                        onChange={(e) => setSignupCpfCnpj(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Senha *</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        required
                        minLength={6}
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-confirm">Confirmar Senha *</Label>
                      <Input
                        id="signup-confirm"
                        type="password"
                        required
                        minLength={6}
                        value={signupConfirm}
                        onChange={(e) => setSignupConfirm(e.target.value)}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Cadastrando..." : "Cadastrar"}
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
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
