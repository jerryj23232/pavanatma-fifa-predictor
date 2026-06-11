import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trophy, Target, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — Pavanatma Predictor" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const uid = user?.id;

  const { data: profile, refetch } = useQuery({
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

  const [fullName, setFullName] = useState("");
  const [course, setCourse] = useState("");
  const [year, setYear] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setCourse(profile.course ?? "");
      setYear(profile.year ?? "");
    }
  }, [profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, course, year })
      .eq("id", uid);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    refetch();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">Your profile</h1>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={Trophy} label="Points" value={lbRow?.total_points ?? 0} />
        <StatCard icon={Target} label="Predictions" value={lbRow?.predictions_made ?? 0} />
        <StatCard icon={CheckCircle2} label="Hits" value={lbRow?.hits ?? 0} />
      </div>

      <form onSubmit={save} className="rounded-2xl border bg-card p-5 shadow-card">
        <div className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div>
            <Label htmlFor="n">Full name</Label>
            <Input id="n" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="c">Course</Label>
              <Input id="c" value={course} onChange={(e) => setCourse(e.target.value)} placeholder="BCom" />
            </div>
            <div>
              <Label htmlFor="y">Year</Label>
              <Input id="y" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2nd" />
            </div>
          </div>
          <Button disabled={saving} className="bg-emerald text-emerald-foreground hover:bg-emerald/90">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-card-grad p-4 shadow-card">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-3xl font-extrabold text-emerald">{value}</div>
    </div>
  );
}
