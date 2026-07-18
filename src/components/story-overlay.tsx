import { useEffect, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type StoryOverlayProps = {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: ReactNode;
  contentClassName?: string;
  overlayClassName?: string;
  closeButtonClassName?: string;
  onKeyDown?: (event: KeyboardEvent) => void;
};

/**
 * Shared presentation shell for immersive, full-screen stories.
 * Data fetching and navigation intentionally stay with each feature.
 */
export function StoryOverlay({
  open,
  onClose,
  ariaLabel,
  children,
  contentClassName,
  overlayClassName,
  closeButtonClassName,
  onKeyDown,
}: StoryOverlayProps) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      onKeyDown?.(event);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onKeyDown, open]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-brightness-50 animate-in fade-in duration-300",
        overlayClassName,
      )}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={onClose}
      onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => event.stopPropagation()}
    >
      <div
        className={cn("relative", contentClassName)}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={cn(
            "absolute right-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/80 text-white shadow-lg ring-1 ring-white/20 backdrop-blur transition hover:bg-black hover:text-neon focus:outline-none focus-visible:ring-2 focus-visible:ring-neon",
            closeButtonClassName,
          )}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
