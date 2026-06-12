import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { MatchCard } from "@/components/match-card";
import { flagFor } from "@/lib/flags";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Clock } from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";

// Keep in sync with dashboard.tsx
const PREDICTION_WINDOW_HOURS = 72;

export const Route = createFileRoute("/_authenticated/matches")({
  head: () => ({ meta: [{ title: "Matches — Pavanatma Predictor" }] }),
  component: MatchesPage,
});

function MatchesPage() {
  const { user } = useAuth();
  const uid = user?.id;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["all-matches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("matches").select("*").order("kickoff_at");
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });

  const { data: preds = [] } = useQuery({
    queryKey: ["my-predictions", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("predictions").select("*").eq("user_id", uid!);
      if (error) throw error;
      return data;
    },
  });

  const map = new Map(preds.map((p) => [p.match_id, p]));
  const windowMs = PREDICTION_WINDOW_HOURS * 3600 * 1000;

  const active: typeof matches = [];
  const upcoming: typeof matches = [];
  const completed: typeof matches = [];
  for (const m of matches) {
    if (m.status === "completed") completed.push(m);
    else {
      const ko = new Date(m.kickoff_at).getTime();
      if (m.status === "scheduled" && ko - now > windowMs) upcoming.push(m);
      else active.push(m);
    }
  }
  completed.sort((a, b) => +new Date(b.kickoff_at) - +new Date(a.kickoff_at));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Matches</h1>
        <p className="text-sm text-muted-foreground">
          Predictions open {PREDICTION_WINDOW_HOURS}h before kickoff.
        </p>
      </div>

      <Tabs defaultValue="active">
        <TabsList className="w-full">
          <TabsTrigger value="active" className="flex-1">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="upcoming" className="flex-1">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="completed" className="flex-1">Completed ({completed.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {isLoading ? <Loading /> : active.length === 0 ? (
            <Empty text="No matches inside the prediction window." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {active.map((m) => <MatchCard key={m.id} match={m} prediction={map.get(m.id)} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="mt-4">
          {isLoading ? <Loading /> : upcoming.length === 0 ? (
            <Empty text="No future fixtures outside the prediction window." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {upcoming.map((m) => (
                <UpcomingCard key={m.id} match={m} now={now} windowMs={windowMs} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {completed.length === 0 ? <Empty text="No completed matches yet." /> : (
            <div className="grid gap-3 sm:grid-cols-2">
              {completed.map((m) => <MatchCard key={m.id} match={m} prediction={map.get(m.id)} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UpcomingCard({ match, now, windowMs }: { match: any; now: number; windowMs: number }) {
  const ko = new Date(match.kickoff_at).getTime();
  const opensAt = ko - windowMs;
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="rounded-full bg-navy/10 px-2 py-0.5 text-navy">{match.stage}</span>
        <span>{format(ko, "MMM d · HH:mm")}</span>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-2xl">{flagFor(match.home_team, match.home_flag)}</span>
          <span className="truncate text-sm font-semibold">{match.home_team}</span>
        </div>
        <span className="text-muted-foreground">vs</span>
        <div className="flex min-w-0 flex-row-reverse items-center gap-2 text-right">
          <span className="text-2xl">{flagFor(match.away_team, match.away_flag)}</span>
          <span className="truncate text-sm font-semibold">{match.away_team}</span>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        Predictions open {formatDistanceToNowStrict(opensAt, { addSuffix: true })}
      </div>
    </div>
  );
}

function Loading() {
  return <div className="grid gap-3 sm:grid-cols-2">{[...Array(4)].map((_, i) => <div key={i} className="h-44 animate-pulse rounded-2xl bg-muted" />)}</div>;
}
function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
