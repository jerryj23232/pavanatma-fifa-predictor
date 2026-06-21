import { Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, CalendarDays, User as UserIcon, Shield, LogOut, LayoutDashboard, Settings } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ReactNode } from "react";

function initialsOf(name: string | null | undefined, email: string | null | undefined) {
  const src = (name || email || "").trim();
  if (!src) return "?";
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || src[0].toUpperCase();
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin(user?.id);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, avatar_url").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  };

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/matches", label: "Matches", icon: CalendarDays },
    { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
    { to: "/profile", label: "Profile", icon: UserIcon },
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: Shield }] : []),
  ] as const;

  const initials = initialsOf(profile?.full_name, user?.email);

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-hero text-navy-foreground shadow-glow">
              <Trophy className="h-4 w-4 text-gold" />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-bold">Pavanatma Predictor</div>
              <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                Pavanatma College, Murickassery
              </div>
            </div>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Open account menu"
              className="rounded-full ring-offset-background transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald focus-visible:ring-offset-2"
            >
              <Avatar className="h-9 w-9 border border-border">
                {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name ?? "Profile"} />}
                <AvatarFallback className="bg-hero text-xs font-bold text-navy-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col">
                  <span className="truncate text-sm font-semibold">{profile?.full_name ?? "Player"}</span>
                  <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/account" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Account settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={signOut} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-5">
          {nav.map((n) => {
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className="flex flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-medium text-muted-foreground"
                activeProps={{ className: "text-emerald" }}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{n.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
