import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { MatchCard } from "@/components/match-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/matches")({
  head: () => ({ meta: [{ title: "Matches — Pavanatma Predictor" }] }),
  component: MatchesPage,
});

function MatchesPage() {
  const { user } = useAuth();
  const uid = user?.id;

  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["all-matches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("matches").select("*").order("kickoff_at");
      if (error) throw error;
      return data;
    },
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
  const upcoming = matches.filter((m) => m.status === "scheduled");
  const completed = matches.filter((m) => m.status === "completed");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Matches</h1>
        <p className="text-sm text-muted-foreground">Submit your predictions before kickoff.</p>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList className="w-full">
          <TabsTrigger value="upcoming" className="flex-1">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="completed" className="flex-1">Completed ({completed.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="mt-4">
          {isLoading ? <Loading /> : upcoming.length === 0 ? <Empty /> : (
            <div className="grid gap-3 sm:grid-cols-2">
              {upcoming.map((m) => <MatchCard key={m.id} match={m} prediction={map.get(m.id)} />)}
            </div>
          )}
        </TabsContent>
        <TabsContent value="completed" className="mt-4">
          {completed.length === 0 ? <Empty /> : (
            <div className="grid gap-3 sm:grid-cols-2">
              {completed.map((m) => <MatchCard key={m.id} match={m} prediction={map.get(m.id)} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Loading() {
  return <div className="grid gap-3 sm:grid-cols-2">{[...Array(4)].map((_, i) => <div key={i} className="h-44 animate-pulse rounded-2xl bg-muted" />)}</div>;
}
function Empty() {
  return <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">Nothing here yet.</div>;
}
