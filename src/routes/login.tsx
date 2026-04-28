import { createFileRoute, useNavigate } from "@tanstack/react-router";
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

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setLoading(false);
    if (error) {
      toast.error("Falha no login", { description: error.message });
    } else {
      toast.success("Bem-vindo de volta!");
      navigate({ to: "/admin" });
    }
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, signupName);
    setLoading(false);
    if (error) {
      toast.error("Falha no cadastro", { description: error.message });
    } else {
      toast.success("Conta criada! Verifique seu e-mail para confirmar.");
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

      <div className="flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/10 p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="flex justify-center">
            <Logo className="h-24" />
          </div>
          <Card className="border-border shadow-lg">
          <CardHeader>
            <CardTitle>Painel administrativo</CardTitle>
            <CardDescription>Acesse sua conta para gerenciar o Mestre 360</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
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
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nome completo</Label>
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
                      minLength={6}
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Criando..." : "Criar conta"}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Apenas e-mails pré-aprovados podem acessar o painel.
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
