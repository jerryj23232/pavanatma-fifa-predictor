import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type Announcement = {
  id: string;
  title: string | null;
  image_url: string;
  link_url: string | null;
  start_at: string;
  end_at: string;
  priority: number;
  is_active: boolean;
};

const DISMISS_KEY = "announcement:dismissed";

export function AnnouncementBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DISMISS_KEY);
      if (raw) setDismissed(JSON.parse(raw));
    } catch {
      /* noop */
    }
  }, []);

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
      return data as Announcement | null;
    },
  });

  const { data: signedUrl } = useQuery({
    queryKey: ["announcement-signed-url", announcement?.id, announcement?.image_url],
    enabled: !!announcement?.image_url,
    staleTime: 55 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("announcements")
        .createSignedUrl(announcement!.image_url, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });

  const isDismissed = useMemo(
    () => (announcement ? dismissed.includes(announcement.id) : false),
    [announcement, dismissed],
  );

  if (!announcement || isDismissed || !signedUrl) return null;

  const dismiss = () => {
    const next = [...dismissed, announcement.id];
    setDismissed(next);
    try {
      sessionStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {
      /* noop */
    }
  };

  const clickable = !!announcement.link_url;
  const onImageClick = () => {
    if (!announcement.link_url) return;
    window.open(announcement.link_url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-4 sm:pt-6"
      role="dialog"
      aria-label={announcement.title ?? "Announcement"}
    >
      <div className="pointer-events-auto relative animate-in fade-in slide-in-from-top-4 duration-500">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="absolute -right-2 -top-2 z-10 rounded-full bg-background/90 p-1.5 text-foreground shadow-lg ring-1 ring-neon/40 backdrop-blur transition hover:bg-background hover:text-neon"
        >
          <X className="h-4 w-4" />
        </button>
        <img
          src={signedUrl}
          alt={announcement.title ?? "Announcement"}
          onClick={onImageClick}
          className={`block h-auto max-h-[70vh] w-auto max-w-[92vw] rounded-2xl object-contain shadow-[0_0_40px_-8px_hsl(var(--neon)/0.45)] sm:max-w-[520px] ${
            clickable ? "cursor-pointer" : ""
          }`}
        />
      </div>
    </div>
  );
}
