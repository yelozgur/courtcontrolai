
"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Trophy, 
  Users, 
  Activity, 
  Play, 
  Clock, 
  ArrowUpRight,
  TrendingUp,
  MapPin,
  Zap,
  Loader2
} from "lucide-react"
import { collection, query, where, limit } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection, useUser } from "@/firebase"

export default function DashboardOverview() {
  const db = useFirestore()
  const { user } = useUser()

  // First, get the user's club ID
  const clubsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "clubs"), where("ownerId", "==", user.uid), limit(1))
  }, [db, user])

  const { data: userClubs } = useCollection(clubsQuery)
  const clubId = userClubs?.[0]?.id

  // Then, filter all data by that club ID
  const tournamentQuery = useMemoFirebase(() => {
    if (!db || !clubId) return null
    return query(collection(db, "tournaments"), where("clubId", "==", clubId), limit(10))
  }, [db, clubId])

  const matchQuery = useMemoFirebase(() => {
    if (!db || !clubId) return null
    return query(collection(db, "matches"), where("clubId", "==", clubId), where("status", "==", "live"), limit(5))
  }, [db, clubId])

  const playersQuery = useMemoFirebase(() => {
    if (!db || !clubId) return null
    return query(collection(db, "participants"), where("clubId", "==", clubId), limit(1))
  }, [db, clubId])

  const { data: tournaments, loading: loadingTours } = useCollection(tournamentQuery)
  const { data: liveMatches, loading: loadingMatches } = useCollection(matchQuery)
  const { data: participants } = useCollection(playersQuery)

  if (!clubId) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold">{userClubs?.[0]?.name}</h1>
          <p className="text-muted-foreground mt-1">Real-time pulse of your club and tournaments.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/club">Club Report</Link>
          </Button>
          <Button className="bg-primary hover:bg-primary/90" asChild>
            <Link href="/dashboard/tournaments/new">
              <Play className="mr-2 h-4 w-4" /> Start Match Day
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/50 border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">My Tournaments</CardTitle>
            <Trophy className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tournaments?.length || 0}</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              <Activity className="mr-1 h-3 w-3 text-accent" /> {liveMatches?.length || 0} live now
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Club Players</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{participants?.length || 0}</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1 text-accent">
              <TrendingUp className="mr-1 h-3 w-3" /> Growth monitoring active
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Venues</CardTitle>
            <MapPin className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userClubs?.[0]?.numCourts || 0} Courts</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              <Clock className="mr-1 h-3 w-3" /> Fully operational
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">System Status</CardTitle>
            <Zap className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">OPTIMIZED</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1 text-accent">
              OR-Tools scheduler is ready
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-6 lg:grid-cols-12 auto-rows-[200px]">
        <Card className="md:col-span-3 lg:col-span-8 row-span-2 bg-gradient-to-br from-card to-background border-border overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <Trophy className="w-32 h-32" />
          </div>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge className="bg-accent text-accent-foreground mb-2">LIVE NOW</Badge>
              <Button size="sm" variant="ghost" className="text-primary hover:text-primary hover:bg-primary/10" asChild>
                <Link href="/dashboard/schedule">
                  View Full Bracket <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <CardTitle className="text-3xl font-headline font-bold">
              {tournaments && tournaments.length > 0 ? tournaments[0].name : "No Active Tournament"}
            </CardTitle>
            <CardDescription>
              Manage your club's current competition and live scoring.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mt-4 space-y-4">
              {loadingMatches ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : liveMatches && liveMatches.length > 0 ? (
                liveMatches.map((match) => (
                  <div key={match.id} className="flex items-center gap-4 p-4 bg-secondary/30 rounded-xl pulse-active">
                    <div className="flex flex-col flex-1">
                      <span className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Court {match.court} • {match.category}</span>
                      <div className="flex items-center justify-between mt-1">
                        <span className="font-bold">{match.teamA.name}</span>
                        <span className="text-accent font-bold">{match.teamA.score}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{match.teamB.name}</span>
                        <span className="text-muted-foreground font-bold">{match.teamB.score}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 bg-secondary/10 rounded-xl border border-border/50 text-center">
                  <p className="text-muted-foreground text-sm">No live matches currently in progress for this club.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3 lg:col-span-4 row-span-2 bg-card border-border">
          <CardHeader>
            <CardTitle className="font-headline font-bold">Upcoming</CardTitle>
            <CardDescription>Next 48 hours</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground italic">Your smart scheduler is monitoring court usage...</p>
            <Button variant="outline" className="w-full mt-2" asChild>
              <Link href="/dashboard/schedule">Open Visual Timeline</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
