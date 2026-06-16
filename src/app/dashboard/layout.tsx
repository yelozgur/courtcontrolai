
"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
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
  ChevronRight,
  LogOut,
  Loader2,
  Heart
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useUser, useAuth, useDoc, useFirestore } from "@/firebase"
import { signOut } from "firebase/auth"
import { doc } from "firebase/firestore"

const sidebarItems = [
  { name: "Overview", icon: LayoutDashboard, href: "/dashboard" },
  { name: "Tournament Wizard", icon: Trophy, href: "/dashboard/tournaments/new" },
  { name: "Scheduling", icon: Calendar, href: "/dashboard/schedule" },
  { name: "Participants", icon: Users, href: "/dashboard/participants" },
  { name: "Sponsors", icon: Heart, href: "/dashboard/sponsors" },
  { name: "Check-In (QR)", icon: QrCode, href: "/dashboard/check-in" },
  { name: "Arena Dashboard", icon: Monitor, href: "/arena" },
  { name: "Player Stats", icon: BarChart3, href: "/player/stats" },
  { name: "Club Settings", icon: Settings, href: "/dashboard/club" },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, loading: authLoading } = useUser()
  const auth = useAuth()
  const db = useFirestore()
  const router = useRouter()

  // Get user profile for roles
  const userRef = (db && user) ? doc(db, "users", user.uid) : null
  const { data: userProfile, loading: profileLoading } = useDoc(userRef)

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  const handleSignOut = () => {
    signOut(auth).then(() => router.push("/"))
  }

  if (authLoading || profileLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) return null

  // For prototype, the first user is admin or we can check role
  const isAdmin = userProfile?.role === "admin" || user.email === "admin@courtcontrol.ai"

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
            {sidebarItems.map((item) => {
              // Only admins see management routes
              if (!isAdmin && (item.href.includes('/new') || item.href.includes('/club') || item.href.includes('/sponsors'))) {
                return null
              }
              
              return (
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
              )
            })}
          </div>
        </ScrollArea>
        <div className="p-4 mt-auto border-t border-border space-y-2">
          <div className="flex items-center gap-3 px-3 py-2 bg-secondary/50 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary overflow-hidden">
              {user.photoURL ? <img src={user.photoURL} alt="Avatar" /> : user.displayName?.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.displayName || "User"}</p>
              <p className="text-xs text-muted-foreground truncate capitalize">{userProfile?.role || "Player"}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive" onClick={handleSignOut}>
            <LogOut className="mr-3 h-5 w-5" /> Sign Out
          </Button>
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
