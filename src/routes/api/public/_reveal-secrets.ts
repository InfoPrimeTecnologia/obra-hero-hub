import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/_reveal-secrets')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = request.headers.get('authorization') || '';
        const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;
        if (!process.env.CRON_SECRET || auth !== expected) {
          return new Response('Unauthorized', { status: 401 });
        }
        return Response.json({
          LOVABLE_API_KEY: process.env.LOVABLE_API_KEY ?? null,
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? null,
          VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? null,
        });
      },
    },
  },
});
