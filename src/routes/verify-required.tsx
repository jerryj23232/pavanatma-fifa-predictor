import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { MailCheck, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/verify-required")({
  head: () => ({ meta: [{ title: "Verify your email — Pavanatma Predictor" }] }),
  component: VerifyRequired,
});

function VerifyRequired() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const resend = async () => {
    setBusy(true);
    try {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email;
      if (!email) throw new Error("No email on file");
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
      toast.success("Verification email sent.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not resend");
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    setBusy(true);
    const { data, error } = await supabase.auth.refreshSession();
    setBusy(false);
    if (error) return toast.error(error.message);
    if (data.user?.email_confirmed_at) navigate({ to: "/dashboard" });
    else toast.error("Still unverified. Check your inbox.");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-hero">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
        <div className="rounded-3xl bg-card p-8 text-center shadow-glow">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald/10">
            <MailCheck className="h-7 w-7 text-emerald" />
          </div>
          <h1 className="text-2xl font-bold">Verify your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You need to confirm your email before predicting matches or appearing on the leaderboard.
            Open the link we emailed you, then come back.
          </p>
          <div className="mt-6 space-y-2">
            <Button onClick={refresh} disabled={busy} className="w-full bg-emerald text-emerald-foreground hover:bg-emerald/90">
              <RefreshCw className="mr-2 h-4 w-4" /> I've verified — continue
            </Button>
            <Button onClick={resend} disabled={busy} variant="outline" className="w-full">
              Resend verification email
            </Button>
            <button onClick={signOut} className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <LogOut className="h-3 w-3" /> Sign out
            </button>
          </div>
          <div className="mt-6 text-xs text-muted-foreground">
            <Link to="/auth" className="text-emerald">Back to sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
