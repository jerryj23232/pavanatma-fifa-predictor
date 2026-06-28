import fifa2026 from "@/assets/nav/fifa2026.png";

type Props = {
  fullName: string;
  points: number;
  made: number;
  hits: number;
};

type StatCardProps = {
  label: string;
  value: number;
};

function StatCard({ label, value }: StatCardProps) {
  return (
    <div
      className="flex flex-col items-start justify-between rounded-md border border-[#1a1a1a] bg-[#0a0a0a] px-2.5 py-2 sm:px-4 sm:py-3"
      style={{
        minWidth: "clamp(60px, 18vw, 90px)",
        boxShadow: "inset 0 0 0 1px rgba(57,255,20,0.08)",
      }}
    >
      <span
        className="text-[8px] sm:text-[10px] font-semibold tracking-widest text-white/60 uppercase"
        style={{ fontFamily: "'Geist', sans-serif" }}
      >
        {label}
      </span>
      <span
        className="mt-0.5 sm:mt-1 font-bold leading-none text-[#39ff14]"
        style={{
          fontFamily: "'Geist', sans-serif",
          fontSize: "clamp(1.35rem, 5vw, 2.25rem)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function DashboardHero({
  fullName,
  points,
  made,
  hits,
}: Props) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-[#39ff14]/40 bg-[#080808]"
      style={{
        boxShadow:
          "0 0 0 1px rgba(57,255,20,0.15), 0 0 32px rgba(57,255,20,0.08), inset 0 0 60px rgba(57,255,20,0.03)",
      }}
    >
      {/* Corner accent lines */}
      <div className="pointer-events-none absolute inset-0 rounded-xl z-10">
        <div className="absolute left-0 top-0 h-px w-16 bg-gradient-to-r from-[#39ff14]/60 to-transparent" />
        <div className="absolute left-0 top-0 h-16 w-px bg-gradient-to-b from-[#39ff14]/60 to-transparent" />
        <div className="absolute bottom-0 right-0 h-px w-16 bg-gradient-to-l from-[#39ff14]/60 to-transparent" />
        <div className="absolute bottom-0 right-0 h-16 w-px bg-gradient-to-t from-[#39ff14]/60 to-transparent" />
      </div>

      {/*
        Outer flex row — always horizontal, never stacks.
        Left  ~70%  →  flex: 2.33
        Right ~30%  →  flex: 1
        Both columns have minWidth:0 to allow shrinking.
      */}
      <div className="flex flex-row items-stretch">

        {/* ── LEFT COLUMN ── */}
        <div
          className="flex flex-col justify-center gap-2 sm:gap-4 px-4 py-5 sm:px-7 sm:py-7 lg:px-10 lg:py-8"
          style={{ flex: "2.33 1 0%", minWidth: 0 }}
        >
          {/* Heading */}
          <div className="flex flex-col leading-none gap-0.5">
            <span
              className="font-normal tracking-widest text-white/70 uppercase"
              style={{
                fontFamily: "'Iceberg', sans-serif",
                fontSize: "clamp(0.55rem, 2vw, 0.875rem)",
              }}
            >
              Welcome Back
            </span>
            <span
              className="font-normal uppercase text-[#39ff14]"
              style={{
                fontFamily: "'Iceberg', sans-serif",
                fontSize: "clamp(1.6rem, 7vw, 3.75rem)",
                lineHeight: 1.05,
              }}
            >
              {fullName}
            </span>
          </div>

          {/* Subtitle */}
          <p
            className="text-white/50"
            style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: "clamp(0.65rem, 2.2vw, 0.875rem)",
            }}
          >
            Predict the next match before kickoff
          </p>

          {/* Stat cards — gap scales with viewport */}
          <div
            className="flex flex-row"
            style={{ gap: "clamp(6px, 2vw, 12px)" }}
          >
            <StatCard label="Points" value={points} />
            <StatCard label="Made" value={made} />
            <StatCard label="Hits" value={hits} />
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        {/*
          overflow:hidden keeps the gradient overlay scoped.
          The image is allowed to be as tall as the hero so it
          becomes the dominant visual element, as in the Figma.
        */}
        <div
          className="relative overflow-hidden flex items-center justify-end"
          style={{ flex: "1 1 0%", minWidth: 0 }}
        >
          {/*
            Premium cinematic fade.
            On mobile the opaque band is wider (50%) so the gradient
            is stronger. On desktop it's narrower (40%) and softer.
            Five stops create a smooth, non-rectangular feel.
          */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10"
            style={{
              width: "clamp(70%, 70%, 40%)",
              background: [
                "linear-gradient(to right,",
                "  #080808        0%,",
                "  rgba(8,8,8,0.92) 30%,",
                "  rgba(8,8,8,0.70) 55%,",
                "  rgba(8,8,8,0.25) 80%,",
                "  transparent    100%",
                ")",
              ].join(" "),
            }}
          />

          <img
            src={fifa2026}
            alt="FIFA World Cup 2026"
            className="relative z-0 object-contain"
            style={{
              /*
                Image height drives the card height — it grows as tall as it
                needs to be. Width is clamped so it feels large but never
                overflows on tiny screens.
              */
              height: "auto",
              width: "clamp(120px, 30vw, 260px)",
              maxWidth: "100%",
              display: "block",
            }}
            draggable={false}
          />
        </div>

      </div>
    </div>
  );
}
