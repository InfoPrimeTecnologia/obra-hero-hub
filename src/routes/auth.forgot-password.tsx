import { createFileRoute, Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useState, type FormEvent } from 'react';
import { requestPasswordReset } from '@/lib/auth-email.functions';
import { Logo } from '@/components/Logo';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const Route = createFileRoute('/auth/forgot-password')({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const request = useServerFn(requestPasswordReset);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await request({ data: { email, origin: window.location.origin } });
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/10 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center"><Logo className="h-20" /></div>
        <Card>
          <CardHeader>
            <CardTitle>Esqueci minha senha</CardTitle>
            <CardDescription>Informe seu e-mail para receber o link de redefinição.</CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4">
                <p className="text-sm">Se este e-mail estiver cadastrado, você receberá um link em instantes. Verifique também a caixa de spam.</p>
                <Button asChild variant="outline" className="w-full"><Link to="/login">Voltar ao login</Link></Button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Enviando...' : 'Enviar link'}
                </Button>
                <p className="text-center text-xs">
                  <Link to="/login" className="text-muted-foreground hover:underline">Voltar ao login</Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
