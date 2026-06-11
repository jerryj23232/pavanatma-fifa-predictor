import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { MatchCard } from "@/components/match-card";
import { flagFor } from "@/lib/flags";
import { Trophy, Target, CheckCircle2, Clock, Radio, CalendarDays, Flag } from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";

// Predictions open this many hours before kickoff.
const PREDICTION_WINDOW_HOURS = 72;

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Pavanatma Predictor" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const uid = user?.id;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const { data: matches = [] } = useQuery({
    queryKey: ["upcoming-matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .order("kickoff_at");
      if (error) throw error;
      return data;
    },
    // Refetch every 30s so live scores update
    refetchInterval: 30_000,
  });

  const { data: myPreds = [] } = useQuery({
    queryKey: ["my-predictions", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("predictions")
        .select("*")
        .eq("user_id", uid!);
      if (error) throw error;
      return data;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", uid!).maybeSingle();
      return data;
    },
  });

  const { data: lbRow } = useQuery({
    queryKey: ["lb-row", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_leaderboard", { _limit: 1000 });
      return data?.find((r) => r.user_id === uid) ?? null;
    },
  });

  const predMap = new Map(myPreds.map((p) => [p.match_id, p]));
  const windowMs = PREDICTION_WINDOW_HOURS * 3600 * 1000;

  const active: typeof matches = [];
  const upcoming: typeof matches = [];
  const live: typeof matches = [];
  const completed: typeof matches = [];

  for (const m of matches) {
    const ko = new Date(m.kickoff_at).getTime();
    if (m.status === "live") live.push(m);
    else if (m.status === "completed") completed.push(m);
    else if (ko - now <= windowMs && ko > now) active.push(m);
    else if (ko > now) upcoming.push(m);
    else live.push(m); // past kickoff but still scheduled (treat as live until sync flips it)
  }
  completed.sort((a, b) => +new Date(b.kickoff_at) - +new Date(a.kickoff_at));

  const points = lbRow?.total_points ?? 0;
  const made = lbRow?.predictions_made ?? 0;
  const hits = lbRow?.hits ?? 0;

  return (
    <div className="space-y-6">
      {/* Hero greeting */}
      <div className="rounded-3xl bg-hero p-5 text-navy-foreground shadow-glow sm:p-7">
        <div className="text-xs font-semibold uppercase tracking-wider text-gold">Welcome back</div>
        <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{profile?.full_name || "Student"}</h1>
        <p className="mt-1 text-sm text-white/75">Predict the next match before kickoff.</p>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-4">
          <Stat icon={Trophy} label="Points" value={points} />
          <Stat icon={Target} label="Made" value={made} />
          <Stat icon={CheckCircle2} label="Hits" value={hits} />
        </div>
      </div>

      {/* 1. Active predictions */}
      <Section
        icon={Target}
        title="Active predictions"
        accent="text-emerald"
        count={active.length}
        subtitle="Lock in your scores before kickoff."
      >
        {active.length === 0 ? (
          <EmptyState text="No matches inside the prediction window. Check Upcoming." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {active.map((m) => (
              <MatchCard key={m.id} match={m} prediction={predMap.get(m.id)} />
            ))}
          </div>
        )}
      </Section>

      {/* 2. Live matches */}
      {live.length > 0 && (
        <Section
          icon={Radio}
          title="Live now"
          accent="text-destructive"
          count={live.length}
          subtitle="Scores update automatically."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {live.map((m) => (
              <MatchCard key={m.id} match={m} prediction={predMap.get(m.id)} />
            ))}
          </div>
        </Section>
      )}

      {/* 3. Upcoming */}
      <Section
        icon={CalendarDays}
        title="Upcoming matches"
        accent="text-navy"
        count={upcoming.length}
        subtitle={`Predictions open ${PREDICTION_WINDOW_HOURS}h before kickoff.`}
      >
        {upcoming.length === 0 ? (
          <EmptyState text="No future fixtures scheduled yet." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.slice(0, 8).map((m) => (
              <UpcomingCard key={m.id} match={m} now={now} windowMs={windowMs} />
            ))}
          </div>
        )}
      </Section>

      {/* 4. Completed */}
      <Section
        icon={Flag}
        title="Completed matches"
        accent="text-gold"
        count={completed.length}
        subtitle="Your predictions and points earned."
      >
        {completed.length === 0 ? (
          <EmptyState text="No completed matches yet." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {completed.slice(0, 6).map((m) => (
              <MatchCard key={m.id} match={m} prediction={predMap.get(m.id)} />
            ))}
          </div>
        )}
        {completed.length > 6 && (
          <div className="mt-3 text-center">
            <Link to="/matches" className="text-xs font-semibold text-emerald">All results →</Link>
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  subtitle,
  count,
  accent,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  count: number;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Icon className={`h-4 w-4 ${accent}`} /> {title}
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {count}
            </span>
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
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

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/10 px-3 py-3 backdrop-blur">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold text-gold">{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">{text}</div>;
}
