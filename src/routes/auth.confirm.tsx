import { createFileRoute, Link, useSearch } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useState } from 'react';
import { confirmEmail } from '@/lib/auth-email.functions';
import { Logo } from '@/components/Logo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/auth/confirm')({
  validateSearch: (s: Record<string, unknown>) => ({ token: (s.token as string) ?? '' }),
  component: ConfirmPage,
});

function ConfirmPage() {
  const { token } = useSearch({ from: '/auth/confirm' });
  const confirm = useServerFn(confirmEmail);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('');

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
                <Button asChild variant="outline" className="w-full"><Link to="/login">Voltar ao login</Link></Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
