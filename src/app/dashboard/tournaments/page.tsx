
"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Trophy, MapPin, Loader2, Search, Plus, ChevronRight, Users, Layers, Clock } from "lucide-react"
import { collection, query, where, orderBy, limit } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection, useUser, useDoc } from "@/firebase"
import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { doc } from "firebase/firestore"
import { StatusBadge } from "@/components/ui/status-badge"

/**
 * CourtControl AI: Organizator dashboard'unun kendi turnuvalarini listeledigi sayfa.
 * Public /tournaments'tan farki: sadece kendi club'ina ait turnuvalari gosterir,
 * status filtresi yok (draft/archived dahil), edit ve yonetim aksiyonlari var.
 */
export default function DashboardTournaments() {
  const db = useFirestore()
  const { user } = useUser()
  const [search, setSearch] = useState("")

  // 1. Resolve current user's clubId
  const userClubsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "clubs"), where("ownerId", "==", user.uid), limit(1))
  }, [db, user])

  const { data: userClubs } = useCollection(userClubsQuery)
  const clubId = userClubs?.[0]?.id

  // 2. Fetch all tournaments for this club (admin icin: tum)
  const tournamentsQuery = useMemoFirebase(() => {
    if (!db || !clubId) return null
    return query(
      collection(db, "tournaments"),
      where("clubId", "==", clubId),
      limit(100)
    )
  }, [db, clubId])

  const { data: tournaments, loading, error } = useCollection(tournamentsQuery)

  // 3. Client-side filter
  const filtered = useMemo(() => {
    if (!tournaments) return []
    return tournaments.filter(t =>
      t.name?.toLowerCase().includes(search.toLowerCase())
    )
  }, [tournaments, search])

  // 4. Stats
  const stats = useMemo(() => {
    if (!tournaments) return { total: 0, draft: 0, open: 0, inProgress: 0, completed: 0 }
    return {
      total: tournaments.length,
      draft: tournaments.filter(t => t.status === "draft").length,
      open: tournaments.filter(t => t.status === "registration_open").length,
      inProgress: tournaments.filter(t => t.status === "in_progress").length,
      completed: tournaments.filter(t => t.status === "completed").length,
    }
  }, [tournaments])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Loading Tournaments</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <p className="text-destructive text-lg font-bold">Failed to load tournaments</p>
        <p className="text-muted-foreground text-sm">{(error as any)?.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-sm font-bold text-primary uppercase tracking-[0.2em]">Management Console</p>
          <h1 className="text-4xl font-headline font-bold uppercase tracking-tighter leading-none">Your Tournaments</h1>
          <p className="text-muted-foreground font-medium mt-1">
            Manage your club's competitive events and registrations.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-10 bg-secondary/30 border-white/10 rounded-xl"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button asChild className="rounded-xl font-bold h-10 px-6">
            <Link href="/tournaments/new">
              <Plus className="mr-2 h-4 w-4" /> New Tournament
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <div className="bg-secondary/20 border border-white/5 rounded-2xl p-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total</p>
          <p className="text-3xl font-headline font-bold mt-1">{stats.total}</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Registration Open</p>
          <p className="text-3xl font-headline font-bold mt-1 text-emerald-400">{stats.open}</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
          <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">In Progress</p>
          <p className="text-3xl font-headline font-bold mt-1 text-amber-400">{stats.inProgress}</p>
        </div>
        <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Completed</p>
          <p className="text-3xl font-headline font-bold mt-1 text-muted-foreground">{stats.completed}</p>
        </div>
      </div>

      {/* Tournament List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 text-center border-2 border-dashed rounded-3xl bg-secondary/10">
          <Trophy className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-2xl font-headline font-bold">No Tournaments Yet</h3>
          <p className="text-muted-foreground max-w-md mt-2">
            {search
              ? `No tournaments match "${search}".`
              : "Create your first tournament to start managing matches and players."}
          </p>
          <Button asChild className="mt-6 h-12 px-8 rounded-xl">
            <Link href="/tournaments/new">
              <Plus className="mr-2 h-4 w-4" /> Create Tournament
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered
            .sort((a, b) => {
              const dateA = a.createdAt?.seconds || 0;
              const dateB = b.createdAt?.seconds || 0;
              return dateB - dateA;
            })
            .map((t) => (
              <Card key={t.id} className="bg-card/40 border-white/5 hover:border-primary/30 transition-all group">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                        <Trophy className="h-6 w-6 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-bold truncate">{t.name}</h3>
                          <StatusBadge status={t.status || 'draft'} />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 flex-wrap">
                          {t.sport && (
                            <span className="flex items-center gap-1">
                              <Layers className="h-3 w-3" /> {t.sport}
                            </span>
                          )}
                          {t.startDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> {t.startDate}
                            </span>
                          )}
                          {t.categories && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" /> {Array.isArray(t.categories) ? t.categories.length : 0} categories
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button variant="ghost" size="sm" asChild className="text-xs font-bold uppercase tracking-widest opacity-60 hover:opacity-100">
                        <Link href={`/dashboard/tournaments/${t.id}/edit`}>Edit</Link>
                      </Button>
                      <Button size="sm" asChild className="bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20">
                        <Link href={`/dashboard/schedule`}>
                          Schedule
                          <ChevronRight className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
