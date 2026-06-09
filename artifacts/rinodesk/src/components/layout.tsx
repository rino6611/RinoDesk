import React from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Ticket, LineChart, MessageSquare, Bell, Headset, LogOut, ClipboardCheck, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetSettings } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";

const BRAND = { name: "RinoDesk", tagline: "Support OS" };

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function Sidebar() {
  const [location] = useLocation();
  const { data: settings } = useGetSettings();
  const { user, logout } = useAuth();

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/tickets", label: "Tickets", icon: Ticket },
    { href: "/insights", label: "Insights", icon: LineChart },
    { href: "/tracker", label: "Tracker", icon: ClipboardCheck },
    { href: "/kb", label: "Knowledge Base", icon: BookOpen },
    { href: "/chat", label: "Agent Chat", icon: MessageSquare },
    { href: "/settings", label: "Alerts", icon: Bell, badge: settings?.alertsEnabled ? "ON" : undefined },
  ];

  return (
    <aside className="w-64 border-r border-border bg-card flex flex-col h-screen fixed left-0 top-0">
      <div className="h-16 flex items-center px-5 border-b border-border">
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-lg shadow-primary/20 transition-transform group-hover:scale-105">
              <Headset className="h-5 w-5" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-bold text-base tracking-tight text-foreground">{BRAND.name}</span>
              <span className="text-[11px] text-muted-foreground">{BRAND.tagline}</span>
            </div>
          </div>
        </Link>
      </div>

      <div className="p-3 flex-1">
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2 px-3">Navigation</div>
        <nav className="space-y-1">
          {links.map((link) => {
            const isActive = location === link.href || (link.href !== "/" && location.startsWith(link.href));
            return (
              <Link key={link.href} href={link.href}>
                <span
                  className={cn(
                    "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-primary" />}
                  <link.icon className="h-4 w-4 shrink-0" />
                  {link.label}
                  {"badge" in link && link.badge && (
                    <span className="ml-auto text-[9px] font-mono bg-primary/20 text-primary px-1.5 py-0.5 rounded">{link.badge}</span>
                  )}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 rounded-lg p-2">
          {user?.picture ? (
            <img src={user.picture} alt={user.name} className="h-9 w-9 rounded-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary/80 to-primary/40 text-xs font-semibold text-primary-foreground">
              {user ? initials(user.name) : "?"}
            </div>
          )}
          <div className="flex flex-col leading-tight min-w-0 flex-1">
            <span className="text-sm font-medium truncate">{user?.name ?? "Guest"}</span>
            <span className="text-xs text-muted-foreground truncate">{user?.email ?? ""}</span>
          </div>
          <button
            onClick={() => logout()}
            title="Log out"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export function Topbar() {
  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur flex items-center justify-between px-8 sticky top-0 z-10">
      <div />
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-xs font-mono text-muted-foreground">SYSTEM ONLINE</span>
      </div>
    </header>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground dark">
      <Sidebar />
      <div className="pl-64 flex flex-col min-h-screen">
        <Topbar />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
