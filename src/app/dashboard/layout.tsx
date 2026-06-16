
"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  Trophy, 
  Calendar, 
  Users, 
  Settings, 
  LayoutDashboard, 
  QrCode, 
  BarChart3, 
  Monitor, 
  Zap,
  ChevronRight
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

const sidebarItems = [
  { name: "Overview", icon: LayoutDashboard, href: "/dashboard" },
  { name: "Tournament Wizard", icon: Trophy, href: "/dashboard/tournaments/new" },
  { name: "Scheduling", icon: Calendar, href: "/dashboard/schedule" },
  { name: "Participants", icon: Users, href: "/dashboard/participants" },
  { name: "Check-In (QR)", icon: QrCode, href: "/dashboard/check-in" },
  { name: "Arena Dashboard", icon: Monitor, href: "/arena" },
  { name: "Player Stats", icon: BarChart3, href: "/player/stats" },
  { name: "Club Settings", icon: Settings, href: "/dashboard/club" },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card/30 backdrop-blur-xl hidden md:flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Zap className="text-primary-foreground h-5 w-5" />
          </div>
          <span className="font-headline font-bold text-lg tracking-tight">CourtControl</span>
        </div>
        <ScrollArea className="flex-1 px-3">
          <div className="space-y-1 py-2">
            {sidebarItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-all hover:bg-primary/10 hover:text-primary",
                  pathname === item.href ? "bg-primary/20 text-primary shadow-sm" : "text-muted-foreground"
                )}
              >
                <item.icon className={cn(
                  "mr-3 h-5 w-5 transition-colors",
                  pathname === item.href ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                )} />
                {item.name}
              </Link>
            ))}
          </div>
        </ScrollArea>
        <div className="p-4 mt-auto border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2 bg-secondary/50 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">JD</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">John Doe</p>
              <p className="text-xs text-muted-foreground truncate">Club Admin</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container max-w-7xl mx-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
