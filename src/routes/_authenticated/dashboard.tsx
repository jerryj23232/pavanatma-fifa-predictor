import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { MatchCard } from "@/components/match-card";
import { Trophy, Target, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Pavanatma Predictor" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const uid = user?.id;

  const { data: matches } = useQuery({
    queryKey: ["upcoming-matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .order("kickoff_at")
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const { data: myPreds } = useQuery({
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

  const upcoming = (matches ?? []).filter((m) => m.status === "scheduled");
  const recent = (matches ?? []).filter((m) => m.status === "completed").slice(0, 3);
  const predMap = new Map(myPreds?.map((p) => [p.match_id, p]) ?? []);
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

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-bold">Upcoming matches</h2>
          <Link to="/matches" className="text-xs font-semibold text-emerald">All matches →</Link>
        </div>
        {upcoming.length === 0 ? (
          <EmptyState text="No matches scheduled yet. Check back soon." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.slice(0, 6).map((m) => (
              <MatchCard key={m.id} match={m} prediction={predMap.get(m.id)} />
            ))}
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Recent results</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {recent.map((m) => (
              <MatchCard key={m.id} match={m} prediction={predMap.get(m.id)} />
            ))}
          </div>
        </section>
      )}
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
  return <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
