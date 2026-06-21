import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "Account Settings — Pavanatma Predictor" }] }),
  component: AccountPage,
});

function AccountPage() {
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
    toast.success("Account updated");
    refetch();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/profile"
          className="grid h-9 w-9 place-items-center rounded-full border bg-card text-muted-foreground hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-extrabold">Account settings</h1>
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
