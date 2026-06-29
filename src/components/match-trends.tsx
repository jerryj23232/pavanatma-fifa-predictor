import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users } from "lucide-react";

type Trends = {
  total: number;
  enough: boolean;
  home_pct?: number;
  draw_pct?: number;
  away_pct?: number;
  top_scores?: { home: number; away: number; count: number }[];
};

export function MatchTrends({ matchId, homeTeam, awayTeam }: { matchId: string; homeTeam: string; awayTeam: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["match-trends", matchId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_match_trends" as never, { _match_id: matchId, _min_predictions: 3 } as never);
      if (error) throw error;
      return data as unknown as Trends;
    },
    staleTime: 60_000,
  });

  if (isLoading) return <div className="h-16 animate-pulse rounded-xl bg-muted" />;
  if (!data) return null;

  if (!data.enough) {
    return (
      <div className="rounded-xl border border-dashed bg-card/50 p-3 text-center text-[11px] text-muted-foreground">
        <Users className="mx-auto mb-1 h-3.5 w-3.5" />
        Community predictions appear after 3+ users predict ({data.total}/3)
      </div>
    );
  }

  const { home_pct = 0, draw_pct = 0, away_pct = 0, top_scores = [], total } = data;

  return (
    <div className="rounded-xl border bg-card/60 p-3">
      <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Community ({total})</span>
      </div>
    <div className="flex h-2 overflow-hidden rounded-full bg-muted">
  <div className="bg-green-500" style={{ width: `${home_pct}%` }} />
  <div className="bg-zinc-500" style={{ width: `${draw_pct}%` }} />
  <div className="bg-amber-500" style={{ width: `${away_pct}%` }} />
</div>

<div className="mt-1.5 grid grid-cols-3 text-[10px] font-semibold">
  <span className="text-green-400">{home_pct}% {homeTeam}</span>
  <span className="text-center text-zinc-400">{draw_pct}% Draw</span>
  <span className="text-right text-amber-400">{away_pct}% {awayTeam}</span>
</div>
      {top_scores.length > 0 && (
        <div className="mt-2 border-t pt-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Most popular</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {top_scores.map((s, i) => (
              <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold tabular-nums">
                {s.home}–{s.away} <span className="font-normal text-muted-foreground">({s.count})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
