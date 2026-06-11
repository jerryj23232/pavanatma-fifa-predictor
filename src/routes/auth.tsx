import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const searchSchema = z.object({ mode: z.enum(["signin", "signup"]).optional().default("signin") });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in — Pavanatma Predictor" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const isSignup = mode === "signup";

  const [fullName, setFullName] = useState("");
  const [course, setCourse] = useState("");
  const [year, setYear] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName, course, year },
          },
        });
        if (error) throw error;
        setSent(true);
        // Update profile metadata once user verifies and signs in.
        toast.success("Check your inbox to verify your email.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const onReset = async () => {
    if (!email.trim()) return toast.error("Enter your email first");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent.");
  };

  return (
    <div className="min-h-screen bg-hero">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
        <Link to="/" className="mb-6 flex items-center gap-2 text-navy-foreground">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 backdrop-blur">
            <Trophy className="h-5 w-5 text-gold" />
          </div>
          <div>
            <div className="text-sm font-bold">Pavanatma Predictor</div>
            <div className="text-[10px] uppercase tracking-wider text-white/70">Murickassery</div>
          </div>
        </Link>

        <div className="rounded-3xl bg-card p-6 shadow-glow sm:p-8">
          <h1 className="text-2xl font-bold">{isSignup ? "Create your account" : "Welcome back"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSignup ? "Join your classmates in the prediction game." : "Sign in to submit your predictions."}
          </p>

          {sent ? (
            <div className="mt-6 rounded-xl border border-emerald/30 bg-emerald/5 p-4 text-sm">
              We sent a verification link to <b>{email}</b>. Open it to activate your account.
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {isSignup && (
                <>
                  <div>
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Thomas" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="course">Course</Label>
                      <Input id="course" value={course} onChange={(e) => setCourse(e.target.value)} placeholder="BCom" />
                    </div>
                    <div>
                      <Label htmlFor="year">Year</Label>
                      <Input id="year" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2nd" />
                    </div>
                  </div>
                </>
              )}
              <div>
                <Label htmlFor="email">College email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@pavanatma.edu" />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-emerald text-emerald-foreground hover:bg-emerald/90" size="lg">
                {loading ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
              </Button>
              {!isSignup && (
                <button type="button" onClick={onReset} className="block w-full text-center text-xs text-muted-foreground hover:text-foreground">
                  Forgot password?
                </button>
              )}
            </form>
          )}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {isSignup ? (
              <>Already registered? <Link to="/auth" search={{ mode: "signin" }} className="font-semibold text-emerald">Sign in</Link></>
            ) : (
              <>New student? <Link to="/auth" search={{ mode: "signup" }} className="font-semibold text-emerald">Register</Link></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
