import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { flagFor } from "@/lib/flags";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Lock, Check } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNowStrict, format } from "date-fns";

export interface Match {
  id: string;
  home_team: string;
  away_team: string;
  home_flag: string | null;
  away_flag: string | null;
  stage: string;
  group_name: string | null;
  kickoff_at: string;
  venue: string | null;
  status: "scheduled" | "live" | "completed";
  home_score: number | null;
  away_score: number | null;
  minute?: number | null;
}
export interface Prediction {
  id: string;
  match_id: string;
  predicted_home: number;
  predicted_away: number;
  points: number;
}

export function MatchCard({ match, prediction }: { match: Match; prediction?: Prediction }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [h, setH] = useState<number | "">(prediction?.predicted_home ?? "");
  const [a, setA] = useState<number | "">(prediction?.predicted_away ?? "");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const kickoff = new Date(match.kickoff_at).getTime();
  const locked = match.status !== "scheduled" || now >= kickoff;

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in required");
      if (h === "" || a === "") throw new Error("Enter both scores");
      const payload = {
        user_id: user.id,
        match_id: match.id,
        predicted_home: Number(h),
        predicted_away: Number(a),
      };
      const { error } = await supabase.from("predictions").upsert(payload, { onConflict: "user_id,match_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prediction saved");
      qc.invalidateQueries({ queryKey: ["my-predictions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const correctOutcome =
    match.status === "completed" &&
    prediction &&
    Math.sign(prediction.predicted_home - prediction.predicted_away) ===
      Math.sign((match.home_score ?? 0) - (match.away_score ?? 0));

  return (
    <div className="rounded-2xl border bg-card-grad p-4 shadow-card">
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald/10 px-2 py-0.5 text-emerald">{match.stage}</span>
          {match.group_name && <span>· Group {match.group_name}</span>}
        </div>
        <span>
          {locked
            ? match.status === "completed"
              ? "Full time"
              : "Locked"
            : formatDistanceToNowStrict(kickoff, { addSuffix: true })}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <TeamSide name={match.home_team} flag={flagFor(match.home_team, match.home_flag)} align="left" />
        <div className="text-center">
          {match.status === "completed" ? (
            <div className="text-2xl font-extrabold">
              {match.home_score} <span className="text-muted-foreground">–</span> {match.away_score}
            </div>
          ) : (
            <div className="text-xs font-semibold text-muted-foreground">
              {format(kickoff, "MMM d · HH:mm")}
            </div>
          )}
        </div>
        <TeamSide name={match.away_team} flag={flagFor(match.away_team, match.away_flag)} align="right" />
      </div>

      {match.venue && <div className="mt-2 text-center text-[11px] text-muted-foreground">📍 {match.venue}</div>}

      <div className="mt-4 border-t pt-3">
        {locked ? (
          <div className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> Your call
            </div>
            {prediction ? (
              <div className="flex items-center gap-3">
                <span className="font-bold tabular-nums">
                  {prediction.predicted_home} – {prediction.predicted_away}
                </span>
                {match.status === "completed" && (
                  <Badge
                    className={
                      prediction.points === 3
                        ? "bg-gold text-gold-foreground"
                        : prediction.points === 1
                        ? "bg-emerald text-emerald-foreground"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    +{prediction.points}
                  </Badge>
                )}
                {match.status === "completed" && correctOutcome && prediction.points === 1 && (
                  <Check className="h-3.5 w-3.5 text-emerald" />
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">No prediction</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={h}
              onChange={(e) => setH(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
              className="h-11 w-14 text-center text-lg font-bold"
              aria-label="Home score"
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={a}
              onChange={(e) => setA(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
              className="h-11 w-14 text-center text-lg font-bold"
              aria-label="Away score"
            />
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              size="sm"
              className="ml-auto bg-emerald text-emerald-foreground hover:bg-emerald/90"
            >
              {prediction ? "Update" : "Predict"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function TeamSide({ name, flag, align }: { name: string; flag: string; align: "left" | "right" }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <span className="text-2xl leading-none">{flag}</span>
      <span className="min-w-0 truncate text-sm font-semibold">{name}</span>
    </div>
  );
}
