import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Trophy, Target, Users, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pavanatma Predictor — FIFA World Cup" },
      { name: "description", content: "FIFA World Cup prediction game for students of Pavanatma College, Murickassery." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden bg-hero text-navy-foreground">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white_1px,transparent_1px),radial-gradient(circle_at_70%_60%,white_1px,transparent_1px)] [background-size:36px_36px,52px_52px]" />
        <div className="relative mx-auto max-w-6xl px-5 py-16 sm:py-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gold">
            <Trophy className="h-3.5 w-3.5" /> Pavanatma College · Murickassery
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-[1.05] sm:text-6xl">
            Predict every match.<br />
            <span className="text-gold">Lift the campus cup.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/80 sm:text-lg">
            The official FIFA World Cup prediction game for our college. Call the
            scores before kickoff, earn points, and rise on the leaderboard.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-gold text-gold-foreground hover:bg-gold/90">
              <Link to="/auth" search={{ mode: "signup" }}>Register with college email</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white">
              <Link to="/auth" search={{ mode: "signin" }}>Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Target, title: "Sharp predictions", body: "Lock in scores before kickoff." },
            { icon: Trophy, title: "Live leaderboard", body: "Climb the campus rankings." },
            { icon: Users, title: "Classmate rivalry", body: "Compete with your batch." },
            { icon: ShieldCheck, title: "Email verified", body: "Only verified students play." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card-grad p-5 shadow-card">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald/10 text-emerald">
                <f.icon className="h-5 w-5" />
              </div>
              <div className="mt-3 font-semibold">{f.title}</div>
              <div className="text-sm text-muted-foreground">{f.body}</div>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-3xl bg-navy p-8 text-navy-foreground shadow-glow sm:p-12">
          <div className="grid gap-4 sm:grid-cols-3 sm:gap-8">
            <div>
              <div className="text-4xl font-extrabold text-gold">3 pts</div>
              <div className="text-sm text-white/70">Exact score</div>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-gold">1 pt</div>
              <div className="text-sm text-white/70">Correct outcome</div>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-gold">0</div>
              <div className="text-sm text-white/70">Otherwise</div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Pavanatma College, Murickassery
      </footer>
    </div>
  );
}
