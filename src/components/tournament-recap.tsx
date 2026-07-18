import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Crown,
  Play,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { StoryOverlay } from "@/components/story-overlay";
import { BadgesRow, type Badge } from "@/components/badges-row";
import { cn } from "@/lib/utils";

type RecapMoment = {
  home_team: string;
  away_team: string;
  stage: string;
  predicted_home: number;
  predicted_away: number;
  home_score: number;
  away_score: number;
  points?: number;
  miss_by?: number;
};

type RankPoint = { rank: number; points: number; at: string };

type RecapData = {
  available: boolean;
  tournament: {
    matches: number;
    completed_matches: number;
    started_at: string | null;
    ended_at: string | null;
  };
  player: {
    full_name: string;
    total_points: number;
    prediction_points: number;
    bonus_points: number;
    predictions: number;
    completed_predictions: number;
    exact_scores: number;
    correct_winners: number;
    accuracy: number;
    longest_streak: number;
  };
  leaderboard: {
    final_rank: number | null;
    previous_rank: number | null;
    highest_rank: number | null;
    timeline: RankPoint[];
  };
  best_prediction: RecapMoment | null;
  heartbreak: RecapMoment | null;
  bonus: { completed: number; missed: number; points: number };
  behaviour: {
    draw_predictions: number;
    knockout_predictions: number;
    knockout_hits: number;
    group_points: number;
    knockout_points: number;
    most_backed_team: string | null;
    most_backed_team_count: number;
  };
  achievements: Badge[];
  fun_facts: string[];
  personality: { name: string; reason: string };
};

const RECAP_STORAGE_PREFIX = "pavanatma-tournament-recap";

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reducedMotion;
}

function AnimatedNumber({
  value,
  suffix = "",
  prefix = "",
  decimals = 0,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
}) {
  const reducedMotion = useReducedMotion();
  const [shown, setShown] = useState(reducedMotion ? value : 0);

  useEffect(() => {
    if (reducedMotion) {
      setShown(value);
      return;
    }

    let animationFrame = 0;
    const duration = 900;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - (1 - progress) ** 4;
      setShown(value * eased);
      if (progress < 1) animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [reducedMotion, value]);

  const display = decimals > 0 ? shown.toFixed(decimals) : Math.round(shown).toLocaleString();
  return (
    <>
      {prefix}
      {display}
      {suffix}
    </>
  );
}

function RecapSlide({
  children,
  className,
  label,
  scene = "default",
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
  scene?: string;
}) {
  const slideRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const slide = slideRef.current;
    if (!slide) return;
    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), {
      threshold: 0.55,
    });
    observer.observe(slide);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={slideRef}
      data-recap-slide
      aria-label={label}
      className={cn(
        "recap-scene relative flex min-h-[100dvh] snap-start flex-col justify-center overflow-hidden px-6 py-16 sm:px-10 lg:px-16",
        `recap-scene-${scene}`,
        isVisible && "recap-slide-active",
        className,
      )}
    >
      <div className="relative z-10 mx-auto w-full max-w-3xl">{children}</div>
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="recap-rise recap-delay-1 mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-neon">
      <span className="h-px w-8 bg-neon" /> {children}
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  accent = "text-white",
}: {
  label: string;
  value: React.ReactNode;
  detail?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur-sm recap-rise">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">{label}</div>
      <div className={cn("mt-1 text-3xl font-extrabold tabular-nums sm:text-4xl", accent)}>
        {value}
      </div>
      {detail && <div className="mt-1 text-xs text-white/55">{detail}</div>}
    </div>
  );
}

function Scoreline({
  moment,
  actualLabel = "Actual",
}: {
  moment: RecapMoment;
  actualLabel?: string;
}) {
  return (
    <div className="rounded-3xl border border-neon/25 bg-black/40 p-5 shadow-glow recap-rise">
      <div className="text-center text-xs font-bold uppercase tracking-[0.16em] text-neon">
        {moment.stage}
      </div>
      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
        <div className="text-sm font-bold sm:text-lg">{moment.home_team}</div>
        <div className="rounded-xl bg-neon px-3 py-2 text-lg font-black text-neon-foreground sm:text-2xl">
          {moment.predicted_home}–{moment.predicted_away}
        </div>
        <div className="text-sm font-bold sm:text-lg">{moment.away_team}</div>
      </div>
      <div className="mt-4 text-center text-xs text-white/55">
        {actualLabel}:{" "}
        <span className="font-bold text-white">
          {moment.home_score}–{moment.away_score}
        </span>
      </div>
    </div>
  );
}

function RankTimeline({ timeline }: { timeline: RankPoint[] }) {
  const highestPoints = Math.max(...timeline.map((point) => point.points), 1);
  if (timeline.length < 2) return null;

  return (
    <div
      className="mt-8 flex h-28 items-end gap-1.5 border-b border-white/10 pb-2 recap-rise"
      aria-label="Rank journey"
    >
      {timeline.map((point, index) => (
        <div
          key={`${point.at}-${index}`}
          className="group relative flex flex-1 flex-col items-center justify-end"
        >
          <div
            className="w-full rounded-t bg-neon/75 transition group-hover:bg-neon"
            style={{ height: `${Math.max(18, (point.points / highestPoints) * 100)}%` }}
          />
          <div className="absolute -top-6 hidden whitespace-nowrap rounded bg-black px-1.5 py-0.5 text-[10px] text-white group-hover:block">
            #{point.rank}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TournamentRecap({ isAdmin = false }: { isAdmin?: boolean }) {
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [preview, setPreview] = useState(false);

  const { data } = useQuery({
    queryKey: ["tournament-recap", user?.id],
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data: recap, error } = await supabase.rpc("get_tournament_recap");
      if (error) throw error;
      return recap as unknown as RecapData;
    },
  });

  const recap = data;
  console.log("Recap:", recap);
  const storageKey = useMemo(() => {
    const tournamentEnd = recap?.tournament.ended_at?.slice(0, 10) ?? "final";
    return `${RECAP_STORAGE_PREFIX}:${tournamentEnd}`;
  }, [recap?.tournament.ended_at]);

  useEffect(() => {
    if (!recap?.available || typeof window === "undefined") return;
    if (window.localStorage.getItem(storageKey) !== "dismissed") setOpen(true);
  }, [recap?.available, storageKey]);

  useEffect(() => {
    if (!open) return;
    const viewport = scrollRef.current;
    if (!viewport) return;
    viewport.scrollTop = 0;
    setActiveSlide(0);
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    if (preview) {
      setPreview(false);
      return;
    }
    if (typeof window !== "undefined") window.localStorage.setItem(storageKey, "dismissed");
  }, [preview, storageKey]);

  const openPreview = () => {
    setPreview(true);
    setOpen(true);
  };

  const goToSlide = useCallback((index: number) => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    const slides = viewport.querySelectorAll<HTMLElement>("[data-recap-slide]");
    const destination = slides[index];
    destination?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const onScroll = () => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    const nextIndex = Math.round(viewport.scrollTop / viewport.clientHeight);
    setActiveSlide(nextIndex);
  };

  if (!recap) return null;

  const canExperienceRecap = recap.available || preview;
  if (!canExperienceRecap) {
    if (!isAdmin) return null;
    return (
      <button
        type="button"
        onClick={openPreview}
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-2 rounded-full border border-dashed border-neon/45 bg-black/90 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.13em] text-neon/85 shadow-card backdrop-blur transition hover:border-neon hover:bg-neon hover:text-neon-foreground md:bottom-6"
      >
        <Play className="h-3.5 w-3.5" /> Preview Wrapped
      </button>
    );
  }

  const totalSlides = 12;
  const facts = recap.fun_facts.length
    ? recap.fun_facts
    : ["Every prediction added a new chapter to your tournament story."];
  const participation = recap.tournament.matches
    ? Math.round((recap.player.predictions / recap.tournament.matches) * 100)
    : 0;
  const rankMovement =
    recap.leaderboard.previous_rank && recap.leaderboard.final_rank
      ? recap.leaderboard.previous_rank - recap.leaderboard.final_rank
      : 0;
  const hasMeaningfulRankHistory =
    recap.leaderboard.timeline.length >= 3 &&
    new Set(recap.leaderboard.timeline.map((point) => point.rank)).size > 1;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-2 rounded-full border border-neon/50 bg-black/90 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-neon shadow-glow backdrop-blur transition hover:scale-105 hover:bg-neon hover:text-neon-foreground md:bottom-6"
        >
          <Trophy className="h-4 w-4" /> Your Wrapped
        </button>
      )}

      <StoryOverlay
        open={open}
        onClose={close}
        ariaLabel="Your Pavanatma Predictor tournament recap"
        overlayClassName="z-[110] bg-black p-0"
        contentClassName="h-[100dvh] w-full overflow-hidden"
        closeButtonClassName="right-5 top-5 bg-black/60"
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowRight" || event.key === "PageDown") {
            event.preventDefault();
            goToSlide(Math.min(activeSlide + 1, totalSlides - 1));
          }
          if (event.key === "ArrowUp" || event.key === "ArrowLeft" || event.key === "PageUp") {
            event.preventDefault();
            goToSlide(Math.max(activeSlide - 1, 0));
          }
        }}
      >
        {preview && (
          <div className="absolute left-5 top-5 z-30 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-gold backdrop-blur">
            Preview Mode <span className="ml-1 text-gold/65">Admin only</span>
          </div>
        )}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth bg-[#080808] text-white"
        >
          <RecapSlide label="Your World Cup Wrapped" scene="opening" className="text-center">
            <div className="recap-rise mx-auto grid h-20 w-20 place-items-center rounded-[2rem] border border-gold/50 bg-gold/10 text-gold shadow-glow">
              <Trophy className="h-10 w-10" strokeWidth={1.6} />
            </div>
            <Eyebrow>Your World Cup Wrapped</Eyebrow>
            <h1 className="recap-rise text-5xl font-normal uppercase leading-[0.88] tracking-[0.03em] sm:text-7xl">
              One tournament.
              <br />
              <span className="text-neon">{recap.tournament.matches} matches.</span>
              <br />
              Your journey.
            </h1>
            <p className="recap-rise recap-delay-2 mx-auto mt-8 max-w-md text-base leading-relaxed text-white/60 sm:text-lg">
              {recap.player.full_name}, every call became part of the story only you could write.
            </p>
            <div className="recap-rise mt-12 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/45">
              Scroll to begin <ArrowDown className="h-4 w-4 animate-bounce text-neon" />
            </div>
          </RecapSlide>

          <RecapSlide label="Predictions submitted" scene="calls">
            <Eyebrow>Chapter 01 · You showed up</Eyebrow>
            <p className="recap-rise recap-delay-1 text-lg text-white/55">
              Before every kickoff, you made your call.
            </p>
            <h2 className="recap-rise recap-delay-2 mt-5 text-5xl font-normal uppercase leading-[0.88] sm:text-7xl">
              <span className="text-white">{recap.player.predictions}</span> predictions later,
              <br />
              <span className="text-neon">your story was written.</span>
            </h2>
            <div className="recap-rise recap-delay-3 mt-12 max-w-xl rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.14em] text-white/50">
                <span>Tournament participation</span>
                <span className="text-neon">{participation}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-neon recap-progress"
                  style={{ width: `${participation}%` }}
                />
              </div>
            </div>
          </RecapSlide>

          <RecapSlide label="Prediction accuracy" scene="accuracy">
            <Eyebrow>Chapter 02 · Your eye for the game</Eyebrow>
            <p className="recap-rise recap-delay-1 text-lg text-white/55">
              Not luck. Your read on the game.
            </p>
            <div className="recap-rise recap-delay-2 mt-6 flex items-end gap-3">
              <div className="recap-number text-7xl font-black leading-none text-neon sm:text-9xl">
                <AnimatedNumber value={recap.player.accuracy} suffix="%" decimals={1} />
              </div>
              <div className="pb-2 text-sm font-bold uppercase tracking-[0.16em] text-white/50">
                accuracy
              </div>
            </div>
            <p className="recap-rise recap-delay-3 mt-6 max-w-lg text-lg leading-relaxed text-white/60">
              The final whistle went your way more often than not. The details were where you shone.
            </p>
            <div className="recap-rise recap-delay-4 mt-11 grid gap-3 sm:grid-cols-2">
              <Metric
                label="Correct winners"
                value={<AnimatedNumber value={recap.player.correct_winners} />}
                accent="text-gold"
              />
              <Metric
                label="Exact scores"
                value={<AnimatedNumber value={recap.player.exact_scores} />}
                accent="text-neon"
              />
            </div>
          </RecapSlide>

          <RecapSlide label="Points earned" scene="points" className="text-center">
            <Eyebrow>Chapter 03 · Your total haul</Eyebrow>
            <p className="recap-rise recap-delay-1 text-lg text-white/55">
              Every prediction mattered. Some changed everything.
            </p>
            <h2 className="recap-number recap-rise recap-delay-2 mt-7 text-8xl font-black leading-none text-gold sm:text-9xl">
              <AnimatedNumber value={recap.player.total_points} />
            </h2>
            <div className="recap-rise recap-delay-3 mt-3 text-xl font-bold uppercase tracking-[0.16em] text-white">
              points in your story
            </div>
            <div className="recap-rise recap-delay-4 mx-auto mt-12 grid max-w-xl gap-3 text-left sm:grid-cols-2">
              <Metric
                label="Match predictions"
                value={<AnimatedNumber value={recap.player.prediction_points} />}
              />
              <Metric
                label="Bonus points"
                value={<AnimatedNumber value={recap.player.bonus_points} />}
                accent="text-neon"
              />
            </div>
          </RecapSlide>

          <RecapSlide label="Leaderboard journey" scene="rank">
            <Eyebrow>Chapter 04 · The climb</Eyebrow>
            <p className="recap-rise recap-delay-1 text-lg text-white/55">
              When the tournament closed, your name stood here.
            </p>
            <h2 className="recap-rise recap-delay-2 mt-5 text-5xl font-normal uppercase leading-[0.9] sm:text-7xl">
              Final position
              <br />
              <span className="recap-number text-neon">#{recap.leaderboard.final_rank ?? "—"}</span>
            </h2>
            <div className="recap-rise recap-delay-3 mt-11 grid max-w-2xl gap-3 sm:grid-cols-2">
              <Metric
                label="Final rank"
                value={recap.leaderboard.final_rank ? `#${recap.leaderboard.final_rank}` : "—"}
                accent="text-neon"
              />
              {hasMeaningfulRankHistory ? (
                <Metric
                  label="Best recorded rank"
                  value={
                    recap.leaderboard.highest_rank ? `#${recap.leaderboard.highest_rank}` : "—"
                  }
                  accent="text-gold"
                />
              ) : (
                <Metric
                  label="Tournament points"
                  value={recap.player.total_points}
                  accent="text-gold"
                />
              )}
            </div>
            {hasMeaningfulRankHistory && (
              <>
                <RankTimeline timeline={recap.leaderboard.timeline} />
                <p className="recap-rise mt-4 text-sm text-white/50">
                  {rankMovement === 0
                    ? "A steady finish when it counted."
                    : `Your final recorded move: ${rankMovement > 0 ? "up" : "down"} ${Math.abs(rankMovement)} places.`}
                </p>
              </>
            )}
          </RecapSlide>

          <RecapSlide label="Biggest win" scene="moment">
            <Eyebrow>Chapter 05 · The one you saw coming</Eyebrow>
            {recap.best_prediction ? (
              <>
                <p className="recap-rise recap-delay-1 text-lg text-white/55">
                  There was one you saw before it happened.
                </p>
                <h2 className="recap-rise recap-delay-2 mt-5 text-4xl font-normal uppercase leading-[0.9] sm:text-6xl">
                  You called it
                  <br />
                  <span className="text-neon">perfectly.</span>
                </h2>
                <div className="recap-delay-3 mt-10">
                  <Scoreline moment={recap.best_prediction} />
                </div>
              </>
            ) : (
              <>
                <h2 className="recap-rise text-4xl font-normal uppercase leading-[0.9] sm:text-6xl">
                  The perfect call
                  <br />
                  <span className="text-neon">is still ahead.</span>
                </h2>
                <p className="recap-rise mt-6 max-w-lg text-lg leading-relaxed text-white/60">
                  It did not land this time. But you stayed in the game until the final whistle.
                </p>
              </>
            )}
          </RecapSlide>

          <RecapSlide label="Heartbreak" scene="heartbreak">
            <Eyebrow>Chapter 06 · So close</Eyebrow>
            {recap.heartbreak ? (
              <>
                <p className="recap-rise recap-delay-1 text-lg text-white/55">
                  Football can be cruel. This was the closest one.
                </p>
                <h2 className="recap-rise recap-delay-2 mt-5 text-4xl font-normal uppercase leading-[0.9] sm:text-6xl">
                  You were only
                  <br />
                  <span className="text-gold">
                    <AnimatedNumber value={recap.heartbreak.miss_by ?? 0} /> goal
                    {recap.heartbreak.miss_by === 1 ? "" : "s"}.
                  </span>
                </h2>
                <div className="recap-delay-3 mt-10">
                  <Scoreline moment={recap.heartbreak} actualLabel="Final score" />
                </div>
              </>
            ) : (
              <>
                <h2 className="recap-rise text-4xl font-normal uppercase leading-[0.9] sm:text-6xl">
                  No near misses.
                  <br />
                  <span className="text-gold">Only lessons.</span>
                </h2>
                <p className="recap-rise mt-6 max-w-lg text-lg leading-relaxed text-white/60">
                  No close calls to haunt you. Just a tournament full of instinct, nerve, and
                  possibility.
                </p>
              </>
            )}
          </RecapSlide>

          <RecapSlide label="Bonus challenges" scene="bonus">
            <Eyebrow>Chapter 07 · Beyond the fixtures</Eyebrow>
            <p className="recap-rise recap-delay-1 text-lg text-white/55">
              The story went beyond ninety minutes.
            </p>
            <h2 className="recap-rise recap-delay-2 mt-5 text-5xl font-normal uppercase leading-[0.9] sm:text-6xl">
              You took on
              <br />
              <span className="text-neon">the bonus game.</span>
            </h2>
            <div className="recap-rise recap-delay-3 mt-11 grid gap-3 sm:grid-cols-3">
              <Metric
                label="Challenges entered"
                value={<AnimatedNumber value={recap.bonus.completed} />}
              />
              <Metric
                label="Challenges missed"
                value={<AnimatedNumber value={recap.bonus.missed} />}
              />
              <Metric
                label="Bonus points"
                value={<AnimatedNumber value={recap.bonus.points} />}
                accent="text-gold"
              />
            </div>
          </RecapSlide>

          <RecapSlide label="Fun facts" scene="facts">
            <Eyebrow>Chapter 08 · The little things</Eyebrow>
            <h2 className="recap-rise text-5xl font-normal uppercase leading-[0.9] sm:text-6xl">
              This is
              <br />
              <span className="text-neon">so you.</span>
            </h2>
            <div className="mt-9 grid gap-3">
              <div className="recap-rise rounded-3xl border border-neon/30 bg-neon/10 p-6 text-xl font-semibold leading-relaxed text-white shadow-glow sm:text-2xl">
                <Sparkles className="mb-5 h-6 w-6 text-neon" />
                {facts[0]}
              </div>
              {facts.slice(1, 4).map((fact, index) => (
                <div
                  key={fact}
                  className="recap-rise flex gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-relaxed text-white/75"
                  style={{ animationDelay: `${(index + 1) * 90}ms` }}
                >
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-neon" /> {fact}
                </div>
              ))}
            </div>
          </RecapSlide>

          <RecapSlide label="Tournament personality" scene="personality" className="text-center">
            <div className="recap-rise mx-auto grid h-20 w-20 place-items-center rounded-full border border-neon/40 bg-neon/10 text-neon shadow-glow">
              <CircleDot className="h-9 w-9" />
            </div>
            <Eyebrow>Tournament personality</Eyebrow>
            <h2 className="recap-rise text-5xl font-normal uppercase leading-[0.9] text-neon sm:text-7xl">
              {recap.personality.name}
            </h2>
            <p className="recap-rise recap-delay-2 mx-auto mt-7 max-w-xl text-lg leading-relaxed text-white/65">
              {recap.personality.reason}
            </p>
            {recap.behaviour.most_backed_team && (
              <div className="recap-rise recap-delay-3 mx-auto mt-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/65">
                <Target className="h-4 w-4 text-gold" /> You kept backing{" "}
                <span className="font-bold text-white">{recap.behaviour.most_backed_team}</span>
              </div>
            )}
          </RecapSlide>

          <RecapSlide label="Achievements" scene="achievements">
            <Eyebrow>Chapter 10 · You earned these</Eyebrow>
            <h2 className="recap-rise text-5xl font-normal uppercase leading-[0.9] sm:text-6xl">
              Proof that
              <br />
              <span className="text-gold">your calls landed.</span>
            </h2>
            {recap.achievements.length ? (
              <>
                <div className="recap-rise mt-7">
                  <BadgesRow badges={recap.achievements} size="lg" />
                </div>
                <div className="recap-rise mt-7 grid gap-3 sm:grid-cols-2">
                  {recap.achievements.map((badge) => (
                    <div
                      key={badge.code}
                      className="flex items-center gap-3 rounded-2xl border border-gold/20 bg-gold/5 p-4"
                    >
                      <span className="text-3xl">{badge.emoji}</span>
                      <div>
                        <div className="font-bold">{badge.name}</div>
                        <div className="text-xs text-white/55">{badge.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="recap-rise mt-7 max-w-lg text-lg leading-relaxed text-white/60">
                No badges yet. But every great run starts with the first brave call.
              </p>
            )}
          </RecapSlide>

          <RecapSlide label="Final tournament summary" scene="finale" className="text-center">
            <div className="recap-rise mx-auto grid h-20 w-20 place-items-center rounded-[2rem] border border-neon/50 bg-neon/10 text-neon shadow-glow">
              <Crown className="h-10 w-10" />
            </div>
            <Eyebrow>The closing ceremony</Eyebrow>
            <h2 className="recap-rise text-5xl font-normal uppercase leading-[0.9] sm:text-7xl">
              The final whistle.
              <br />
              <span className="text-neon">Your story stays.</span>
            </h2>
            <div className="recap-rise mx-auto mt-10 grid max-w-2xl grid-cols-2 gap-3 text-left sm:grid-cols-4">
              <Metric label="Points" value={recap.player.total_points} accent="text-gold" />
              <Metric
                label="Rank"
                value={recap.leaderboard.final_rank ? `#${recap.leaderboard.final_rank}` : "—"}
                accent="text-neon"
              />
              <Metric label="Predictions" value={recap.player.predictions} />
              <Metric label="Accuracy" value={`${recap.player.accuracy}%`} />
            </div>
            <p className="recap-rise mt-9 text-lg leading-relaxed text-white/60">
              You brought a voice to every kickoff. The next tournament is already waiting for your
              call.
            </p>
            <button
              type="button"
              onClick={close}
              className="recap-rise mt-8 inline-flex items-center gap-2 rounded-full bg-neon px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-neon-foreground transition hover:brightness-110"
            >
              <CheckCircle2 className="h-4 w-4" /> Close the ceremony
            </button>
          </RecapSlide>
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-neon/70 shadow-glow" />
        <div className="absolute bottom-5 right-4 z-20 hidden flex-col gap-2 sm:flex">
          {Array.from({ length: totalSlides }).map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Go to recap slide ${index + 1}`}
              onClick={() => goToSlide(index)}
              className={cn(
                "h-2 rounded-full transition-all",
                activeSlide === index
                  ? "w-7 bg-neon shadow-glow"
                  : "w-2 bg-white/30 hover:bg-white/70",
              )}
            />
          ))}
        </div>
        {activeSlide < totalSlides - 1 && (
          <button
            type="button"
            onClick={() => goToSlide(activeSlide + 1)}
            className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-black/40 p-2 text-white/65 backdrop-blur transition hover:border-neon/50 hover:text-neon"
            aria-label="Next recap slide"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        )}
      </StoryOverlay>
    </>
  );
}
