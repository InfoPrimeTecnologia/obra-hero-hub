import { createFileRoute, Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useState, type FormEvent } from 'react';
import { resetPassword } from '@/lib/auth-email.functions';
import { Logo } from '@/components/Logo';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export const Route = createFileRoute('/auth/reset-password')({
  validateSearch: (s: Record<string, unknown>) => ({ token: (s.token as string) ?? '' }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = useSearch({ from: '/auth/reset-password' });
  const navigate = useNavigate();
  const reset = useServerFn(resetPassword);
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const checks = {
    length: pwd.length >= 8,
    upper: /[A-Z]/.test(pwd),
    lower: /[a-z]/.test(pwd),
    number: /[0-9]/.test(pwd),
    match: pwd.length > 0 && pwd === confirm,
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) { toast.error('Token ausente'); return; }
    if (!checks.length || !checks.upper || !checks.lower || !checks.number) {
      toast.error('A senha não atende aos requisitos'); return;
    }
    if (!checks.match) { toast.error('As senhas não conferem'); return; }
    setLoading(true);
    try {
      const r = await reset({ data: { token, newPassword: pwd } });
      if (r.ok) {
        toast.success('Senha redefinida! Faça login com a nova senha.');
        navigate({ to: '/login' });
      } else {
        toast.error(r.error);
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro inesperado');
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
            <CardTitle>Redefinir senha</CardTitle>
            <CardDescription>Crie uma nova senha para acessar sua conta.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pwd">Nova senha</Label>
                <Input id="pwd" type="password" required minLength={8} value={pwd} onChange={(e) => setPwd(e.target.value)} />
                <ul className="space-y-1 pt-1 text-xs">
                  {[
                    { ok: checks.length, label: 'Pelo menos 8 caracteres' },
                    { ok: checks.upper, label: 'Uma letra maiúscula' },
                    { ok: checks.lower, label: 'Uma letra minúscula' },
                    { ok: checks.number, label: 'Um número' },
                  ].map((r) => (
                    <li key={r.label} className={r.ok ? 'text-primary' : 'text-muted-foreground'}>
                      {r.ok ? '✓' : '○'} {r.label}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar senha</Label>
                <Input id="confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Salvando...' : 'Redefinir senha'}
              </Button>
              <p className="text-center text-xs">
                <Link to="/login" className="text-muted-foreground hover:underline">Voltar ao login</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
