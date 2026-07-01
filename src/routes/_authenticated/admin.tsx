import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { flagFor } from "@/lib/flags";
import { Trash2, RefreshCw } from "lucide-react";


export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Pavanatma Predictor" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);
  if (authLoading || roleLoading) {
    return <div className="h-32 animate-pulse rounded-2xl bg-muted" />;
  }
  if (!isAdmin) {
    return <Navigate to="/dashboard" />;
  }
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Admin panel</h1>
        <SyncMatchesButton />
      </div>
      <Tabs defaultValue="matches">
        <TabsList>
          <TabsTrigger value="matches">Matches</TabsTrigger>
          <TabsTrigger value="new">Add match</TabsTrigger>
        </TabsList>
        <TabsContent value="matches" className="mt-4"><ManageMatches /></TabsContent>
        <TabsContent value="new" className="mt-4"><AddMatch /></TabsContent>
      </Tabs>
    </div>
  );
}

function SyncMatchesButton() {
  const qc = useQueryClient();
  const sync = useServerFn(syncMatches);
  const m = useMutation({
    mutationFn: async () => await sync(),
    onSuccess: (r: { fetched: number; upserted: number }) => {
      toast.success(`Synced ${r.upserted} of ${r.fetched} fixtures`);
      qc.invalidateQueries({ queryKey: ["admin-matches"] });
      qc.invalidateQueries({ queryKey: ["all-matches"] });
      qc.invalidateQueries({ queryKey: ["upcoming-matches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Button
      onClick={() => m.mutate()}
      disabled={m.isPending}
      className="bg-navy text-navy-foreground hover:bg-navy/90"
    >
      <RefreshCw className={`mr-2 h-4 w-4 ${m.isPending ? "animate-spin" : ""}`} />
      {m.isPending ? "Syncing…" : "Sync Matches"}
    </Button>
  );
}


function AddMatch() {
  const qc = useQueryClient();
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [stage, setStage] = useState("Group Stage");
  const [group, setGroup] = useState("");
  const [venue, setVenue] = useState("");
  const [kickoff, setKickoff] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!home || !away || !kickoff) throw new Error("Fill required fields");
      const { error } = await supabase.from("matches").insert({
        home_team: home, away_team: away, stage,
        group_name: group || null, venue: venue || null,
        kickoff_at: new Date(kickoff).toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Match added");
      setHome(""); setAway(""); setGroup(""); setVenue(""); setKickoff("");
      qc.invalidateQueries({ queryKey: ["all-matches"] });
      qc.invalidateQueries({ queryKey: ["upcoming-matches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
      className="space-y-4 rounded-2xl border bg-card p-5 shadow-card"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Home team</Label>
          <Input value={home} onChange={(e) => setHome(e.target.value)} placeholder="Argentina" required />
        </div>
        <div>
          <Label>Away team</Label>
          <Input value={away} onChange={(e) => setAway(e.target.value)} placeholder="France" required />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label>Stage</Label>
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Group Stage", "Round of 16", "Quarter-final", "Semi-final", "Third-place", "Final"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Group</Label>
          <Input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="A" />
        </div>
        <div>
          <Label>Venue</Label>
          <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Lusail" />
        </div>
      </div>
      <div>
        <Label>Kickoff</Label>
        <Input type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} required />
      </div>
      <Button disabled={create.isPending} className="bg-emerald text-emerald-foreground hover:bg-emerald/90">
        {create.isPending ? "Adding…" : "Add match"}
      </Button>
    </form>
  );
}

function ManageMatches() {
  const qc = useQueryClient();
  const { data: matches = [] } = useQuery({
    queryKey: ["admin-matches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("matches").select("*").order("kickoff_at");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-3">
      {matches.map((m) => <AdminMatchRow key={m.id} match={m} onChange={() => {
        qc.invalidateQueries({ queryKey: ["admin-matches"] });
        qc.invalidateQueries({ queryKey: ["all-matches"] });
        qc.invalidateQueries({ queryKey: ["upcoming-matches"] });
        qc.invalidateQueries({ queryKey: ["leaderboard"] });
      }} />)}
      {matches.length === 0 && <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">No matches yet.</div>}
    </div>
  );
}

function AdminMatchRow({ match, onChange }: { match: any; onChange: () => void }) {
  const [hs, setHs] = useState<number | "">(match.home_score ?? "");
  const [as_, setAs] = useState<number | "">(match.away_score ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async (status: "completed" | "scheduled") => {
    setSaving(true);
    const patch: any =
      status === "completed"
        ? { status, home_score: Number(hs), away_score: Number(as_) }
        : { status, home_score: null, away_score: null };
    const { error } = await supabase.from("matches").update(patch).eq("id", match.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(status === "completed" ? "Result saved · points awarded" : "Reset to scheduled");
    onChange();
  };

  const remove = async () => {
    if (!confirm(`Delete ${match.home_team} vs ${match.away_team}? Predictions will be removed.`)) return;
    const { error } = await supabase.from("matches").delete().eq("id", match.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    onChange();
  };

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
        <span>{match.stage} {match.group_name && `· Group ${match.group_name}`}</span>
        <span>{format(new Date(match.kickoff_at), "MMM d · HH:mm")}</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xl">{flagFor(match.home_team)}</span>
          <span className="truncate font-semibold">{match.home_team}</span>
        </div>
        <span className="text-muted-foreground">vs</span>
        <div className="flex min-w-0 items-center gap-2 text-right">
          <span className="truncate font-semibold">{match.away_team}</span>
          <span className="text-xl">{flagFor(match.away_team)}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        <Input
          type="number" min={0} value={hs}
          onChange={(e) => setHs(e.target.value === "" ? "" : Number(e.target.value))}
          className="h-10 w-16 text-center font-bold" placeholder="—"
        />
        <span>–</span>
        <Input
          type="number" min={0} value={as_}
          onChange={(e) => setAs(e.target.value === "" ? "" : Number(e.target.value))}
          className="h-10 w-16 text-center font-bold" placeholder="—"
        />
        <Button size="sm" disabled={saving || hs === "" || as_ === ""} onClick={() => submit("completed")}
          className="bg-emerald text-emerald-foreground hover:bg-emerald/90">
          Save result
        </Button>
        {match.status === "completed" && (
          <Button size="sm" variant="outline" onClick={() => submit("scheduled")}>Reopen</Button>
        )}
        <Button size="icon" variant="ghost" onClick={remove} className="ml-auto text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {match.status}
        </span>
      </div>
    </div>
  );
}
