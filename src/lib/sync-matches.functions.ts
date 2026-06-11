import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Football-Data.org competition codes (FIFA World Cup = WC)
const COMPETITION = "WC";

type FDMatch = {
  id: number;
  utcDate: string;
  status: string; // SCHEDULED | TIMED | LIVE | IN_PLAY | PAUSED | FINISHED | POSTPONED | SUSPENDED | CANCELLED
  stage?: string;
  group?: string | null;
  venue?: string | null;
  homeTeam: { name: string; shortName?: string; tla?: string };
  awayTeam: { name: string; shortName?: string; tla?: string };
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

export const syncMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Authorize: admin only
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden");

    const apiKey = process.env.FOOTBALL_DATA_API_KEY;
    if (!apiKey) throw new Error("FOOTBALL_DATA_API_KEY is not configured");

    const res = await fetch(`https://api.football-data.org/v4/competitions/${COMPETITION}/matches`, {
      headers: { "X-Auth-Token": apiKey },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Football-Data API error ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { matches?: FDMatch[] };
    const matches = json.matches ?? [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const rows = matches.map((m) => {
      const status = mapStatus(m.status);
      const completed = status === "completed";
      return {
        external_id: String(m.id),
        home_team: m.homeTeam?.name ?? "TBD",
        away_team: m.awayTeam?.name ?? "TBD",
        kickoff_at: m.utcDate,
        status,
        stage: mapStage(m.stage),
        group_name: m.group ? m.group.replace(/^GROUP_/, "") : null,
        venue: m.venue ?? null,
        home_score: completed ? m.score.fullTime.home : null,
        away_score: completed ? m.score.fullTime.away : null,
        winner: m.score.winner ?? null,
      };
    });

    let upserted = 0;
    // Upsert in chunks to avoid hitting payload limits
    const chunk = 100;
    for (let i = 0; i < rows.length; i += chunk) {
      const slice = rows.slice(i, i + chunk);
      const { error, count } = await supabaseAdmin
        .from("matches")
        .upsert(slice, { onConflict: "external_id", count: "exact" });
      if (error) throw new Error(error.message);
      upserted += count ?? slice.length;
    }

    return { fetched: matches.length, upserted };
  });
