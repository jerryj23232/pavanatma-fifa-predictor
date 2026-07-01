// Supabase Edge Function: sync-matches
// Fetches fixtures from Football-Data.org and upserts into public.matches.
// Auth: caller must be an authenticated admin (checked via has_role RPC using
// the caller's JWT). This runs in Deno, where FOOTBALL_DATA_API_KEY is
// reliably available via Deno.env — unlike the Cloudflare Worker runtime
// used by TanStack server functions.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const COMPETITION = "WC";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type FDMatch = {
  id: number;
  utcDate: string;
  status: string;
  stage?: string;
  group?: string | null;
  venue?: string | null;
  minute?: number | string | null;
  homeTeam: { name: string };
  awayTeam: { name: string };
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    fullTime: { home: number | null; away: number | null };
  };
};

function mapStatus(s: string): "scheduled" | "live" | "completed" {
  if (s === "FINISHED") return "completed";
  if (s === "LIVE" || s === "IN_PLAY" || s === "PAUSED") return "live";
  return "scheduled";
}

function mapStage(s?: string): string {
  if (!s) return "Group Stage";
  const m: Record<string, string> = {
    GROUP_STAGE: "Group Stage",
    LAST_16: "Round of 16",
    QUARTER_FINALS: "Quarter-final",
    SEMI_FINALS: "Semi-final",
    THIRD_PLACE: "Third-place",
    FINAL: "Final",
  };
  return m[s] ?? s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const apiKey = Deno.env.get("FOOTBALL_DATA_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "FOOTBALL_DATA_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify caller is admin (uses the user's JWT).
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch fixtures
    const res = await fetch(
      `https://api.football-data.org/v4/competitions/${COMPETITION}/matches`,
      { headers: { "X-Auth-Token": apiKey } },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Football-Data API error ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { matches?: FDMatch[] };
    const matches = json.matches ?? [];

    const rows = matches.map((m) => {
      const status = mapStatus(m.status);
      const completed = status === "completed";
      const live = status === "live";
      return {
        external_id: String(m.id),
        home_team: m.homeTeam?.name ?? "TBD",
        away_team: m.awayTeam?.name ?? "TBD",
        kickoff_at: m.utcDate,
        status,
        stage: mapStage(m.stage),
        group_name: m.group ? m.group.replace(/^GROUP_/, "") : null,
        venue: m.venue ?? null,
        home_score: completed || live ? m.score.fullTime.home : null,
        away_score: completed || live ? m.score.fullTime.away : null,
        winner: m.score.winner ?? null,
        minute: live && m.minute != null ? Number(m.minute) : null,
      };
    });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let upserted = 0;
    const chunk = 100;
    for (let i = 0; i < rows.length; i += chunk) {
      const slice = rows.slice(i, i + chunk);
      const { error, count } = await admin
        .from("matches")
        .upsert(slice, { onConflict: "external_id", count: "exact" });
      if (error) throw new Error(error.message);
      upserted += count ?? slice.length;
    }

    return new Response(JSON.stringify({ ok: true, fetched: matches.length, upserted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sync-matches failed", e);
    const message = e instanceof Error ? e.message : "Sync failed";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
