import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type Badge = { code: string; emoji: string; name: string; description: string };

export function BadgesRow({ badges, size = "sm", max }: { badges: Badge[]; size?: "sm" | "md" | "lg"; max?: number }) {
  if (!badges?.length) return null;
  const shown = max ? badges.slice(0, max) : badges;
  const extra = max && badges.length > max ? badges.length - max : 0;
  const cls = size === "lg" ? "text-2xl" : size === "md" ? "text-lg" : "text-sm";
  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center gap-1">
        {shown.map((b) => (
          <Tooltip key={b.code}>
            <TooltipTrigger asChild>
              <span className={`${cls} leading-none cursor-help`} aria-label={b.name}>{b.emoji}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <div className="font-bold">{b.name}</div>
              <div className="text-muted-foreground">{b.description}</div>
            </TooltipContent>
          </Tooltip>
        ))}
        {extra > 0 && <span className="text-[10px] font-bold text-muted-foreground">+{extra}</span>}
      </div>
    </TooltipProvider>
  );
}

export function RankMovement({ current, previous }: { current: number | null | undefined; previous: number | null | undefined }) {
  if (!current || !previous) {
    return <span className="text-[10px] font-bold text-muted-foreground" title="New entry">NEW</span>;
  }
  const diff = previous - current; // positive = moved up
  if (diff > 0) return <span className="text-[11px] font-bold text-emerald" title={`Up ${diff}`}>↑{diff}</span>;
  if (diff < 0) return <span className="text-[11px] font-bold text-destructive" title={`Down ${-diff}`}>↓{-diff}</span>;
  return <span className="text-[11px] font-bold text-muted-foreground" title="No change">→</span>;
}
