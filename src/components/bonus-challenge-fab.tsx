import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { flagFor } from "@/lib/flags";
import { Trophy, Check, Loader2, Timer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Challenge = {
  id: string;
  title: string;
  description: string | null;
  team_pool: string[];
  deadline: string;
  is_active: boolean;
};

type Prediction = {
  id: string;
  challenge_id: string;
  teams: string[];
};

function useCountdown(deadline: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline]);
  return useMemo(() => {
    if (!deadline) return { expired: true, label: "" };
    const ms = new Date(deadline).getTime() - now;
    if (ms <= 0) return { expired: true, label: "Closed" };
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const label =
      d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
    return { expired: false, label };
  }, [deadline, now]);
}

export function BonusChallengeFab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const { data: challenge } = useQuery<Challenge | null>({
    queryKey: ["bonus-challenge-active"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bonus_challenges")
        .select("id, title, description, team_pool, deadline, is_active")
        .eq("is_active", true)
        .order("deadline", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Challenge) ?? null;
    },
  });

  const { data: prediction } = useQuery<Prediction | null>({
    queryKey: ["bonus-prediction", challenge?.id, user?.id],
    enabled: !!user && !!challenge?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bonus_predictions")
        .select("id, challenge_id, teams")
        .eq("challenge_id", challenge!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Prediction) ?? null;
    },
  });

  const countdown = useCountdown(challenge?.deadline);
  const submitted = !!prediction;
  const locked = countdown.expired || !challenge?.is_active;

  useEffect(() => {
    if (open) {
      setSelected(prediction?.teams ?? []);
    }
  }, [open, prediction]);

  if (!user || !challenge) return null;
  if (locked && !submitted) return null; // hide after deadline if not submitted

  const toggle = (team: string) => {
    setSelected((prev) => {
      if (prev.includes(team)) return prev.filter((t) => t !== team);
      if (prev.length >= 4) {
        toast.error("You can only pick 4 teams");
        return prev;
      }
      return [...prev, team];
    });
  };

  const submit = async () => {
    if (selected.length !== 4) {
      toast.error("Pick exactly 4 teams");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        user_id: user.id,
        challenge_id: challenge.id,
        teams: selected,
      };
      const { error } = prediction
        ? await supabase.from("bonus_predictions").update({ teams: selected }).eq("id", prediction.id)
        : await supabase.from("bonus_predictions").insert(payload);
      if (error) throw error;
      toast.success(prediction ? "Prediction updated" : "Prediction submitted");
      await qc.invalidateQueries({ queryKey: ["bonus-prediction", challenge.id, user.id] });
      setOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to submit";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open bonus challenge"
        className={cn(
          "fixed right-4 z-40 flex items-center gap-2 rounded-full px-4 py-3 text-xs font-bold shadow-glow transition",
          "bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-6",
          submitted
            ? "bg-secondary text-neon border border-neon/40"
            : "bg-neon text-neon-foreground hover:brightness-110 animate-pulse",
        )}
      >
        {submitted ? (
          <>
            <Check className="h-4 w-4" />
            <span>Submitted</span>
          </>
        ) : (
          <>
            <Trophy className="h-4 w-4" />
            <span className="hidden sm:inline">Bonus Challenge</span>
            <span className="flex items-center gap-1 rounded-full bg-black/25 px-2 py-0.5 font-mono text-[10px]">
              <Timer className="h-3 w-3" />
              {countdown.label}
            </span>
          </>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              🏆 FIFA Bonus Challenge
            </DialogTitle>
            <DialogDescription>
              {challenge.description ??
                "Predict the four semifinalists before the deadline to earn bonus points."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-xs">
            <span className="text-muted-foreground">Closes in</span>
            <span className="font-mono font-bold text-neon">
              {countdown.expired ? "Closed" : countdown.label}
            </span>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3 text-xs">
            <div className="mb-2 font-semibold text-foreground">Scoring</div>
            <ul className="grid grid-cols-2 gap-1 text-muted-foreground">
              <li>4 correct → <span className="text-neon font-bold">+10</span></li>
              <li>3 correct → <span className="text-neon font-bold">+5</span></li>
              <li>2 correct → <span className="text-neon font-bold">+3</span></li>
              <li>1 correct → <span className="text-neon font-bold">+2</span></li>
            </ul>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold">Pick 4 teams</span>
              <span className={cn("font-mono", selected.length === 4 ? "text-neon" : "text-muted-foreground")}>
                {selected.length}/4
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {challenge.team_pool.map((team) => {
                const isSel = selected.includes(team);
                return (
                  <button
                    key={team}
                    type="button"
                    disabled={locked}
                    onClick={() => toggle(team)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-2 py-2 text-left text-xs transition",
                      isSel
                        ? "border-neon bg-neon/10 text-foreground shadow-glow"
                        : "border-border bg-card text-muted-foreground hover:border-neon/40 hover:text-foreground",
                      locked && "opacity-60",
                    )}
                  >
                    <span className="text-lg leading-none">{flagFor(team)}</span>
                    <span className="truncate font-semibold">{team}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2">
            <div className="text-xs text-muted-foreground">
              {submitted && !locked && "You can update your picks until the deadline."}
              {submitted && locked && "Predictions are locked."}
              {!submitted && !locked && "Submitting locks in your picks."}
            </div>
            <Button
              onClick={submit}
              disabled={locked || submitting || selected.length !== 4}
              className="bg-neon text-neon-foreground hover:brightness-110"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitted ? "Update" : "Submit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
