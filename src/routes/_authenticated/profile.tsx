import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Progress } from "@/components/ui/progress";
import {
  Trophy,
  Target,
  CheckCircle2,
  Hash,
  Flame,
  Crosshair,
  Zap,
  TrendingUp,
  Award,
  BarChart3,
  Sparkles,
  Medal,
} from "lucide-react";
import type { Badge } from "@/components/badges-row";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — Pavanatma Predictor" }] }),
  component: ProfilePage,
});

type Stats = {
  total_points: number;
  total_predictions: number;
  completed_predictions: number;
  exact_scores: number;
  correct_winners: number;
  accuracy: number;
  best_matchday: number;
  current_streak: number;
  longest_streak: number;
  rank: number;
  avg_points: number;
};

function ProfilePage() {
  const { user } = useAuth();
  const uid = user?.id;



  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["user-stats", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data: row } = await supabase
        .from("user_stats")
        .select("*")
        .eq("user_id", uid!)
        .maybeSingle();
      if (!row) return null;
      const { count } = await supabase
        .from("user_stats")
        .select("user_id", { count: "exact", head: true })
        .gt("total_points", row.total_points);
      return {
        total_points: row.total_points,
        total_predictions: row.predictions_count,
        completed_predictions: row.completed_predictions,
        exact_scores: row.exact_scores,
        correct_winners: row.correct_winners,
        accuracy: Number(row.accuracy_percentage),
        best_matchday: row.best_matchday_score,
        current_streak: row.current_streak,
        longest_streak: row.longest_streak,
        rank: (count ?? 0) + 1,
        avg_points: Number(row.average_points_per_match),
      } as Stats;
    },
  });

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-normal uppercase tracking-[0.12em]">YOUR PROFILE</h1>

      <AchievementsSection uid={uid} />

      <StatisticsSection stats={stats} loading={statsLoading} />
    </div>
  );
}

function StatisticsSection({ stats, loading }: { stats: Stats | null | undefined; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  if (!stats || stats.total_predictions === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-card p-10 text-center shadow-card">
        <Sparkles className="mx-auto h-10 w-10 text-emerald" />
        <h2 className="mt-3 text-lg font-bold">No predictions yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Make your first prediction to start tracking your stats.
        </p>
      </div>
    );
  }

  // Determine strongest metric to highlight
  const candidates = [
    { key: "accuracy", value: stats.accuracy, label: "Accuracy" },
    { key: "streak", value: stats.longest_streak * 10, label: "Streak" },
    { key: "exact", value: stats.exact_scores * 15, label: "Exact Scores" },
  ];
  const strongest = candidates.reduce((a, b) => (b.value > a.value ? b : a)).key;

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-normal uppercase tracking-[0.12em]">STATISTICS</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Trophy}
            label="Total Points"
            value={stats.total_points}
            accent
          />
          <StatCard
            icon={Hash}
            label="Current Rank"
            value={stats.rank > 0 ? `#${stats.rank}` : "—"}
          />
          <StatCard
            icon={Target}
            label="Accuracy"
            value={`${stats.accuracy}%`}
            highlight={strongest === "accuracy"}
          >
            <Progress value={stats.accuracy} className="mt-2 h-1.5" />
          </StatCard>
          <StatCard
            icon={CheckCircle2}
            label="Predictions Made"
            value={stats.total_predictions}
          />
        </div>
      </section>

      {/* Performance */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-normal uppercase tracking-[0.12em]">PERFORMANCE</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Crosshair}
            label="Exact Scores"
            value={stats.exact_scores}
            sub="3 pts each"
            highlight={strongest === "exact"}
          />
          <StatCard
            icon={Zap}
            label="Correct Winners"
            value={stats.correct_winners}
            sub="1 pt each"
          />
          <StatCard
            icon={Flame}
            label="Current Streak"
            value={stats.current_streak}
            sub="in a row"
            highlight={strongest === "streak" && stats.current_streak > 0}
          />
          <StatCard
            icon={Award}
            label="Best Matchday"
            value={stats.best_matchday}
            sub="single day"
          />
        </div>
      </section>

      {/* Advanced Analytics */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-normal uppercase tracking-[0.12em]">ADVANCED ANALYTICS</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border bg-card-grad p-5 shadow-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <BarChart3 className="h-3.5 w-3.5" /> Accuracy Rate
              </div>
              <div className="text-2xl font-extrabold text-emerald">{stats.accuracy}%</div>
            </div>
            <Progress value={stats.accuracy} className="mt-3 h-2" />
            <div className="mt-2 text-xs text-muted-foreground">
              {stats.exact_scores + stats.correct_winners} of {stats.completed_predictions} completed predictions hit
            </div>
          </div>

          <div className="rounded-2xl border bg-card-grad p-5 shadow-card">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" /> Avg Points / Match
            </div>
            <div className="mt-1 text-3xl font-extrabold text-emerald">{stats.avg_points}</div>
            <div className="mt-2 text-xs text-muted-foreground">
              Based on {stats.completed_predictions} completed match{stats.completed_predictions === 1 ? "" : "es"}
            </div>
          </div>

          <div className="rounded-2xl border bg-card-grad p-5 shadow-card">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Flame className="h-3.5 w-3.5" /> Longest Streak
            </div>
            <div className="mt-1 text-3xl font-extrabold text-emerald">{stats.longest_streak}</div>
            <div className="mt-2 text-xs text-muted-foreground">consecutive correct predictions</div>
          </div>

          <div className="rounded-2xl border bg-card-grad p-5 shadow-card">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Target className="h-3.5 w-3.5" /> Prediction Success Breakdown
            </div>
            <SuccessBar
              exact={stats.exact_scores}
              winner={stats.correct_winners}
              total={stats.completed_predictions}
            />
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <Legend color="bg-emerald" label={`Exact ${stats.exact_scores}`} />
              <Legend color="bg-gold" label={`Winner ${stats.correct_winners}`} />
              <Legend color="bg-muted" label={`Miss ${Math.max(0, stats.completed_predictions - stats.exact_scores - stats.correct_winners)}`} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  highlight,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  sub?: string;
  accent?: boolean;
  highlight?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`relative rounded-2xl border bg-card-grad p-4 shadow-card ${
        highlight ? "ring-2 ring-emerald" : ""
      }`}
    >
      {highlight && (
        <span className="absolute right-3 top-3 rounded-full bg-emerald/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald">
          Top
        </span>
      )}
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`mt-1 text-3xl font-extrabold ${accent ? "text-emerald" : ""}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      {children}
    </div>
  );
}

function SuccessBar({ exact, winner, total }: { exact: number; winner: number; total: number }) {
  if (total === 0) return <div className="h-2 rounded-full bg-muted" />;
  const ex = (exact / total) * 100;
  const wn = (winner / total) * 100;
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-muted">
      <div className="bg-emerald" style={{ width: `${ex}%` }} />
      <div className="bg-gold" style={{ width: `${wn}%` }} />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </div>
  );
}

function AchievementsSection({ uid }: { uid: string | undefined }) {
  const { data: earned = [] } = useQuery({
    queryKey: ["user-achievements", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_achievements" as never)
        .select("code, earned_at")
        .eq("user_id", uid!);
      if (error) throw error;
      return (data ?? []) as unknown as { code: string; earned_at: string }[];
    },
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ["achievements-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("achievements" as never)
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as Badge[] & { sort_order: number }[];
    },
  });

  const earnedSet = new Set(earned.map((e) => e.code));

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-normal uppercase tracking-[0.12em]">
  <Medal className="h-4 w-4 text-gold" />ACHIEVEMENTS</h2>
        <span className="text-xs text-muted-foreground">{earnedSet.size} / {catalog.length}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(catalog as unknown as Badge[]).map((b) => {
          const got = earnedSet.has(b.code);
          return (
            <div
              key={b.code}
              className={`flex items-center gap-3 rounded-2xl border p-3 shadow-card transition ${
                got ? "bg-card-grad" : "bg-muted/30 opacity-60"
              }`}
            >
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-2xl ${got ? "bg-gold/20" : "bg-muted grayscale"}`}>
                {b.emoji}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">{b.name}</div>
                <div className="truncate text-xs text-muted-foreground">{b.description}</div>
              </div>
              {got && <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-emerald" />}
            </div>
          );
        })}
      </div>
    </section>
  );
}
