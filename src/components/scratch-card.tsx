import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
type ScratchCardProps = {
  code: string;
};

export function RewardScratchCard({ code }: ScratchCardProps) { 
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const hasCelebrated = useRef(false);

const [revealed, setRevealed] = useState(false);
 const fireConfetti = () => {
  confetti({
    particleCount: 120,
    spread: 75,
    origin: { y: 0.6 },
  });
};   

useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  // Matte black scratch layer
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Label
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px Arial";
  ctx.textAlign = "center";
  ctx.fillText("SCRATCH HERE", canvas.width / 2, canvas.height / 2);
  let scratching = false;

const scratch = (x: number, y: number) => {
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(x, y, 22, 0, Math.PI * 2);
  ctx.fill();
};

const getPosition = (e: MouseEvent) => {
  const rect = canvas.getBoundingClientRect();

  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
};
const getTouchPosition = (e: TouchEvent) => {
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];

  return {
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top,
  };
};

canvas.addEventListener("mousedown", () => {
  scratching = true;
});

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  scratching = true;

  const pos = getTouchPosition(e);
  scratch(pos.x, pos.y);
});

window.addEventListener("mouseup", () => {
  scratching = false;
});

window.addEventListener("touchend", () => {
  scratching = false;
});

canvas.addEventListener("mousemove", (e) => {
  if (!scratching) return;

  const pos = getPosition(e);
  scratch(pos.x, pos.y);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

let transparent = 0;

for (let i = 3; i < pixels.length; i += 4) {
  if (pixels[i] === 0) transparent++;
}

const scratched = transparent / (pixels.length / 4);
if (scratched > 0.65 && !hasCelebrated.current) {
  hasCelebrated.current = true;
  setRevealed(true);
  fireConfetti();
}
});
canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();

  if (!scratching) return;

  const pos = getTouchPosition(e);
  scratch(pos.x, pos.y);
});

return () => {
  window.removeEventListener("mouseup", () => {});
};

}, []);
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="relative overflow-hidden rounded-3xl border border-neon/30 bg-[#111] shadow-glow">

        {/* Hidden reward */}
        <div className="flex h-52 flex-col items-center justify-center">

          <div className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">
            Your Reward
          </div>

          <div className="mt-4 text-3xl font-black text-neon">
            {code}
          </div>

          <button className="mt-6 rounded-full border border-neon/30 px-5 py-2 text-sm font-bold text-neon">
            Copy Code
          </button>

        </div>
        <canvas
  ref={canvasRef}
  className={`absolute inset-0 h-full w-full rounded-3xl touch-none transition-opacity duration-500 ${
    revealed ? "opacity-0 pointer-events-none" : "opacity-100"
  }`}
/>
      </div>
    </div>
  );
}