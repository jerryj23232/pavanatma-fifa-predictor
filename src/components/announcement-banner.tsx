import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { StoryOverlay } from "@/components/story-overlay";

type Announcement = {
  id: string;
  title: string | null;
  image_url: string | null;
  images: string[] | null;
  link_url: string | null;
  start_at: string;
  end_at: string;
  priority: number;
  is_active: boolean;
};

export function AnnouncementBanner() {
  const { user } = useAuth();
  const [closed, setClosed] = useState(false);
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const { data: announcement } = useQuery({
    queryKey: ["active-announcement"],
    enabled: !!user?.id,
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("is_active", true)
        .lte("start_at", nowIso)
        .gte("end_at", nowIso)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Announcement | null;
    },
  });

  const paths = useMemo<string[]>(() => {
    if (!announcement) return [];
    const arr = Array.isArray(announcement.images) ? announcement.images.filter(Boolean) : [];
    if (arr.length > 0) return arr;
    return announcement.image_url ? [announcement.image_url] : [];
  }, [announcement]);

  const { data: signedUrls } = useQuery({
    queryKey: ["announcement-signed-urls", announcement?.id, paths],
    enabled: !!announcement && paths.length > 0,
    staleTime: 55 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("announcements")
        .createSignedUrls(paths, 60 * 60);
      if (error) throw error;
      return (data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[];
    },
  });

  if (!announcement || closed || !signedUrls?.length) return null;

  const total = signedUrls.length;
  const current = signedUrls[Math.min(index, total - 1)];
  const clickable = !!announcement.link_url;

  const onImageClick = () => {
    if (announcement.link_url) window.open(announcement.link_url, "_blank", "noopener,noreferrer");
  };

  const next = () => setIndex((i) => (i + 1) % total);
  const prev = () => setIndex((i) => (i - 1 + total) % total);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40 || total < 2) return;
    if (dx < 0) next();
    else prev();
  };

  return (
    <StoryOverlay
      open
      onClose={() => setClosed(true)}
      ariaLabel={announcement.title ?? "Announcement"}
      contentClassName="animate-in zoom-in-95 fade-in duration-300"
      closeButtonClassName="-right-3 -top-3"
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") next();
        if (event.key === "ArrowLeft") prev();
      }}
    >
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="relative">
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={prev}
                aria-label="Previous"
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-black/80 hover:text-neon"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Next"
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-black/80 hover:text-neon"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          <img
            key={current}
            src={current}
            alt={announcement.title ?? "Announcement"}
            onClick={onImageClick}
            className={`block h-auto max-h-[85vh] w-auto max-w-[92vw] object-contain shadow-[0_0_60px_-10px_hsl(var(--neon)/0.55)] animate-in fade-in duration-300 sm:max-w-[640px] ${
              clickable ? "cursor-pointer" : ""
            }`}
          />
        </div>

        {total > 1 && (
          <div className="mt-3 flex items-center justify-center gap-2">
            {signedUrls.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all ${
                  i === index ? "w-6 bg-neon" : "w-2 bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </StoryOverlay>
  );
}
