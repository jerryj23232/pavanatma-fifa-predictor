import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-hero">
      <div className="mx-auto flex min-h-screen max-w-md items-center px-5">
        <form onSubmit={onSubmit} className="w-full rounded-3xl bg-card p-6 shadow-glow sm:p-8">
          <h1 className="text-2xl font-bold">Set a new password</h1>
          <div className="mt-5">
            <Label htmlFor="pw">New password</Label>
            <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button disabled={loading} className="mt-5 w-full bg-emerald text-emerald-foreground hover:bg-emerald/90" size="lg">
            {loading ? "Saving…" : "Update password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
