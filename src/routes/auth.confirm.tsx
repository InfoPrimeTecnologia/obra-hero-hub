import { createFileRoute, Link, useSearch } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useState } from 'react';
import { confirmEmail, resendConfirmation } from '@/lib/auth-email.functions';
import { Logo } from '@/components/Logo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export const Route = createFileRoute('/auth/confirm')({
  validateSearch: (s: Record<string, unknown>) => ({ token: (s.token as string) ?? '' }),
  component: ConfirmPage,
});

function ConfirmPage() {
  const { token } = useSearch({ from: '/auth/confirm' });
  const confirm = useServerFn(confirmEmail);
  const resend = useServerFn(resendConfirmation);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('Token ausente.');
      return;
    }
    confirm({ data: { token } })
      .then((r) => {
        if (r.ok) setState('ok');
        else {
          setState('error');
          setMessage(r.error);
        }
      })
      .catch((e) => {
        setState('error');
        setMessage(e?.message ?? 'Erro inesperado');
      });
  }, [token]);

  const handleResend = async () => {
    if (!resendEmail) {
      toast.error('Informe seu e-mail');
      return;
    }
    setResending(true);
    try {
      const r = await resend({ data: { email: resendEmail, origin: window.location.origin } });
      if (r.ok) {
        toast.success('Novo link enviado! Verifique seu e-mail.');
        setResent(true);
      } else {
        toast.error(r.error);
      }
    } catch (e: any) {
      toast.error('Falha ao reenviar', { description: e?.message });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/10 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center"><Logo className="h-20" /></div>
        <Card>
          <CardHeader><CardTitle>Confirmação de e-mail</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {state === 'loading' && <p className="text-muted-foreground">Confirmando seu e-mail...</p>}
            {state === 'ok' && (
              <>
                <p>✅ E-mail confirmado com sucesso! Sua conta está ativa.</p>
                <Button asChild className="w-full"><Link to="/login">Ir para o login</Link></Button>
              </>
            )}
            {state === 'error' && (
              <>
                <p className="text-destructive">{message || 'Não foi possível confirmar.'}</p>
                <div className="rounded-md border border-border bg-muted/40 p-3 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Seu link pode ter expirado. Informe seu e-mail abaixo para receber um novo link de confirmação.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="resend-email">E-mail</Label>
                    <Input
                      id="resend-email"
                      type="email"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      placeholder="seu@email.com"
                      disabled={resent}
                    />
                  </div>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={handleResend}
                    disabled={resending || resent || !resendEmail}
                  >
                    {resent ? 'E-mail enviado ✓' : resending ? 'Enviando...' : 'Reenviar e-mail de confirmação'}
                  </Button>
                </div>
                <Button asChild variant="outline" className="w-full"><Link to="/login">Voltar ao login</Link></Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
