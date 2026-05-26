import { createFileRoute, Link, useSearch } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useState } from 'react';
import { consumeMagicLink } from '@/lib/auth-email.functions';
import { supabase } from '@/integrations/supabase/client';
import { Logo } from '@/components/Logo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';



export const Route = createFileRoute('/auth/magic-link')({
  validateSearch: (s: Record<string, unknown>) => ({ token: (s.token as string) ?? '' }),
  component: MagicLinkPage,
});

function MagicLinkPage() {
  const { token } = useSearch({ from: '/auth/magic-link' });
  const consume = useServerFn(consumeMagicLink);
  const [state, setState] = useState<'loading' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error'); setMessage('Token ausente.'); return;
    }
    consume({ data: { token, origin: window.location.origin } })
      .then((r) => {
        if (r.ok && r.actionLink) {
          // Redireciona pro action_link gerado pelo Supabase, que cria a sessão e volta pra home
          window.location.href = r.actionLink;
        } else if (!r.ok) {
          setState('error'); setMessage(r.error);
        }
      })
      .catch((e) => {
        setState('error'); setMessage(e?.message ?? 'Erro inesperado');
      });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/10 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center"><Logo className="h-20" /></div>
        <Card>
          <CardHeader><CardTitle>Entrando...</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {state === 'loading' && <p className="text-muted-foreground">Validando seu link de acesso...</p>}
            {state === 'error' && (
              <>
                <p className="text-destructive">{message}</p>
                <Button asChild variant="outline" className="w-full"><Link to="/login">Voltar ao login</Link></Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
