import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Trophy, Medal } from "lucide-react";
import { BadgesRow, RankMovement, type Badge } from "@/components/badges-row";

type PeriodRow = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  total_points: number;
};

function PeriodLeaderboard({
  title,
  icon,
  period,
  emptyText,
}: {
  title: string;
  icon: string;
  period: "day" | "week";
  emptyText: string;
}) {
  const { user } = useAuth();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["period-leaderboard", period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_period_leaderboard", {
        _period: period,
        _limit: 3,
      });
      if (error) throw error;
      return (data ?? []) as PeriodRow[];
    },
  });

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg" aria-hidden>{icon}</span>
        <h2 className="text-sm font-bold uppercase tracking-wide">{title}</h2>
      </div>
      {isLoading ? (
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
      ) : rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">{emptyText}</div>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, i) => {
            const isMe = r.user_id === user?.id;
            return (
              <li
                key={r.user_id}
                className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm ${isMe ? "bg-emerald/10 ring-1 ring-emerald/30" : ""}`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="w-5 shrink-0 text-xs font-bold tabular-nums text-muted-foreground">#{i + 1}</span>
                  <span className="truncate font-semibold">
                    {r.full_name ?? "Player"}
                    {isMe && <span className="ml-1 text-xs text-emerald">(you)</span>}
                  </span>
                </div>
                <span className="shrink-0 text-sm font-extrabold tabular-nums text-emerald">
                  {r.total_points} <span className="text-xs font-medium text-muted-foreground">pts</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}


export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard — Pavanatma Predictor" }] }),
  component: LeaderboardPage,
});

type Row = {
  user_id: string;
  full_name: string | null;
  course: string | null;
  avatar_url: string | null;
  total_points: number;
  hits: number;
  predictions_made: number;
  current_rank: number | null;
  previous_rank: number | null;
  badges: Badge[] | null;
};

function LeaderboardPage() {
  const { user } = useAuth();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_leaderboard", { _limit: 100 });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const top = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Campus Leaderboard</h1>
        <p className="text-sm text-muted-foreground">3 points exact score · 1 point correct result</p>
      </div>

      {isLoading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      ) : (
        <>
          {/* Podium */}
          <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
            {[top[1], top[0], top[2]].map((r, i) => {
              if (!r) return <div key={i} />;
              const rank = i === 1 ? 1 : i === 0 ? 2 : 3;
              const colors = {
                1: "bg-gold text-gold-foreground",
                2: "bg-secondary",
                3: "bg-secondary",
              } as const;
              const heights = {
                1: "h-36 sm:h-48",
                2: "h-24 sm:h-32",
                3: "h-16 sm:h-24",
              } as const;
              return (
                <div key={r.user_id} className="flex flex-col items-center">
                  <div className="mb-2 text-center">
                    <div className="flex items-center justify-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <span>#{rank}</span>
                      <RankMovement current={r.current_rank} previous={r.previous_rank} />
                    </div>
                    <div className="line-clamp-1 max-w-[120px] text-sm font-bold">{r.full_name}</div>
                    <div className="text-lg font-extrabold text-emerald">{r.total_points}</div>
                    {r.badges && r.badges.length > 0 && (
                      <div className="mt-1 flex justify-center">
                        <BadgesRow badges={r.badges} size="md" max={4} />
                      </div>
                    )}
                  </div>
                  <div className={`grid w-full place-items-center rounded-t-2xl ${heights[rank]} ${colors[rank]} shadow-card`}>
                    {rank === 1 ? <Trophy className="h-7 w-7" /> : <Medal className="h-6 w-6" />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* List */}
          <div className="overflow-hidden rounded-2xl border bg-card">
            {rest.map((r, idx) => {
              const rank = idx + 4;
              const isMe = r.user_id === user?.id;
              return (
                <div
                  key={r.user_id}
                  className={`flex items-center justify-between gap-3 px-4 py-3 ${idx !== rest.length - 1 ? "border-b" : ""} ${isMe ? "bg-emerald/5" : ""}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex w-12 flex-col items-end leading-tight">
                      <span className="text-sm font-bold tabular-nums text-muted-foreground">{rank}</span>
                      <RankMovement current={r.current_rank} previous={r.previous_rank} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-semibold">{r.full_name} {isMe && <span className="text-xs text-emerald">(you)</span>}</div>
                        {r.badges && r.badges.length > 0 && <BadgesRow badges={r.badges} size="sm" max={3} />}
                      </div>
                      {r.course && <div className="truncate text-xs text-muted-foreground">{r.course}</div>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-right">
                    <div className="text-xs text-muted-foreground"><b>{r.hits}</b> hits</div>
                    <div className="text-base font-extrabold text-emerald tabular-nums">{r.total_points}</div>
                  </div>
                </div>
              );
            })}
            {rows.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">No scores yet. Be first!</div>
            )}
          </div>
        </>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PeriodLeaderboard
          title="Weekly Leaderboard"
          icon="🏆"
          period="week"
          emptyText="No points scored this week yet."
        />
        <PeriodLeaderboard
          title="Daily Leaderboard"
          icon="⚡"
          period="day"
          emptyText="No points scored today yet."
        />
      </div>
    </div>
  );
}
