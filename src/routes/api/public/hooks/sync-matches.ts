import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/sync-matches")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-api-key") ?? request.headers.get("apikey");
        if (!token) return new Response("Unauthorized", { status: 401 });

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: ok, error: verifyErr } = await supabaseAdmin.rpc("verify_sync_webhook", {
            _token: token,
          });
          if (verifyErr || ok !== true) {
            return new Response("Unauthorized", { status: 401 });
          }

          const { runMatchSync } = await import("@/lib/sync-matches.server");
          const result = await runMatchSync();
          return new Response(JSON.stringify({ ok: true, ...result }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          // Log full detail server-side; return a generic message to the caller.
          console.error("sync-matches webhook failed", e);
          return new Response(
            JSON.stringify({ ok: false, error: "Sync failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
