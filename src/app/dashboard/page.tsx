
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
  Loader2,
  Building,
  Settings2,
  AlertCircle
} from "lucide-react"
import { collection, query, where, limit, doc } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection, useUser, useDoc } from "@/firebase"

export default function DashboardOverview() {
  const db = useFirestore()
  const { user, loading: authLoading } = useUser()

  // Get user profile for role and direct clubId reference
  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);
  const { data: profile, loading: profileLoading } = useDoc(userProfileRef);

  // Robust Admin Detection
  const isAdmin = user?.email?.toLowerCase() === 'admin@deneme.com' || profile?.role === 'admin';

  // Find the user's club (for non-admins)
  const clubsQuery = useMemoFirebase(() => {
    if (!db || !user || isAdmin) return null
    return query(collection(db, "clubs"), where("ownerId", "==", user.uid), limit(1))
  }, [db, user, isAdmin])

  const { data: userClubs, loading: loadingClub } = useCollection(clubsQuery)
  
  // Resolve clubId from profile first, then from the query
  const clubId = isAdmin ? null : (profile?.clubId || userClubs?.[0]?.id)
  const activeClub = userClubs?.[0]

  // Queries for Dashboard Data
  const tournamentQuery = useMemoFirebase(() => {
    if (!db) return null
    if (isAdmin) return query(collection(db, "tournaments"), limit(20))
    if (!clubId) return null
    return query(collection(db, "tournaments"), where("clubId", "==", clubId), limit(20))
  }, [db, clubId, isAdmin])

  const matchQuery = useMemoFirebase(() => {
    if (!db) return null
    if (isAdmin) return query(collection(db, "matches"), where("status", "==", "live"), limit(10))
    if (!clubId) return null
    return query(collection(db, "matches"), where("clubId", "==", clubId), where("status", "==", "live"), limit(10))
  }, [db, clubId, isAdmin])

  const playersQuery = useMemoFirebase(() => {
    if (!db) return null
    if (isAdmin) return query(collection(db, "participants"), limit(10))
    if (!clubId) return null
    return query(collection(db, "participants"), where("clubId", "==", clubId), limit(10))
  }, [db, clubId, isAdmin])

  const allClubsQuery = useMemoFirebase(() => {
    if (!db || !isAdmin) return null
    return collection(db, "clubs")
  }, [db, isAdmin])

  const { data: tournaments, loading: loadingTours } = useCollection(tournamentQuery)
  const { data: liveMatches, loading: loadingMatches } = useCollection(matchQuery)
  const { data: participants } = useCollection(playersQuery)
  const { data: allClubs } = useCollection(allClubsQuery)

  const isDataSyncing = authLoading || profileLoading || (loadingClub && !isAdmin)

  if (isDataSyncing) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse text-xs uppercase tracking-widest font-bold">Synchronizing Dashboard...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold text-white uppercase tracking-tighter">
            {isAdmin ? "Platform Overview" : (activeClub?.name || "Club Dashboard")}
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">
            {isAdmin ? "Global network performance and metrics." : "Real-time pulse of your club and tournaments."}
          </p>
        </div>
        <div className="flex gap-2">
          {!isAdmin && (
            <>
              <Button variant="outline" className="border-white/10 hover:bg-white/5" asChild>
                <Link href="/dashboard/club">Club Report</Link>
              </Button>
              <Button className="bg-primary hover:bg-primary/90" asChild>
                <Link href="/dashboard/tournaments/new">
                  <Play className="mr-2 h-4 w-4" /> Launch Tournament
                </Link>
              </Button>
            </>
          )}
          {isAdmin && (
             <Button variant="outline" className="border-accent text-accent hover:bg-accent/10" asChild>
                <Link href="/dashboard/admin/clubs">Manage All Clubs</Link>
             </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-white/5 border-white/5 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
              {isAdmin ? "Total Tournaments" : "My Tournaments"}
            </CardTitle>
            <Trophy className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{tournaments?.length || 0}</div>
            <p className="text-xs text-muted-foreground flex items-center mt-2">
              <Activity className="mr-1 h-3 w-3 text-accent" /> {liveMatches?.length || 0} live now
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/5 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
              {isAdmin ? "Global Players" : "Club Players"}
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{participants?.length || 0}</div>
            <p className="text-xs text-muted-foreground flex items-center mt-2 text-accent">
              <TrendingUp className="mr-1 h-3 w-3" /> Growth monitoring active
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/5 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
              {isAdmin ? "Total Clubs" : "Venues"}
            </CardTitle>
            <Building className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {isAdmin ? (allClubs?.length || 0) : (activeClub?.numCourts || 0)} {isAdmin ? "Active" : "Courts"}
            </div>
            <p className="text-xs text-muted-foreground flex items-center mt-2">
              <Clock className="mr-1 h-3 w-3" /> Fully operational
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/5 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest">System Status</CardTitle>
            <Zap className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white uppercase tracking-tighter">Optimized</div>
            <p className="text-xs text-muted-foreground flex items-center mt-2 text-accent">
              Real-time engine ready
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-6 lg:grid-cols-12">
        <div className="md:col-span-3 lg:col-span-8 space-y-6">
          <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" /> My Competitions
          </h2>
          <div className="grid gap-4">
             {loadingTours ? (
               <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>
             ) : tournaments && tournaments.length > 0 ? (
               tournaments.map((t) => (
                 <Card key={t.id} className="bg-card/50 border-white/5 hover:border-primary/20 transition-all">
                   <CardContent className="p-6 flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center text-primary">
                          <Trophy className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="font-bold text-lg">{t.name}</p>
                          <p className="text-sm text-muted-foreground">{t.sport} • {t.startDate}</p>
                        </div>
                     </div>
                     <div className="flex gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/tournaments/${t.id}/edit`}>
                            <Settings2 className="mr-2 h-4 w-4" /> Manage
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/arena/${t.id}`}>Arena</Link>
                        </Button>
                     </div>
                   </CardContent>
                 </Card>
               ))
             ) : (
               <Card className="bg-card/50 border-dashed border-2 p-12 text-center text-muted-foreground flex flex-col items-center gap-4">
                 <AlertCircle className="h-10 w-10 opacity-20" />
                 <div>
                   <h3 className="text-lg font-bold text-white">No Tournaments Found</h3>
                   <p className="text-sm">Create your first competition to start tracking scores.</p>
                 </div>
                 {!isAdmin && (
                   <Button size="sm" asChild>
                     <Link href="/dashboard/tournaments/new">Start Wizard</Link>
                   </Button>
                 )}
               </Card>
             )}
          </div>
        </div>

        <div className="md:col-span-3 lg:col-span-4 space-y-6">
          <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-accent" /> Live Scoring
          </h2>
          <div className="space-y-4">
              {loadingMatches ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-accent" /></div>
              ) : liveMatches && liveMatches.length > 0 ? (
                liveMatches.map((match) => (
                  <Card key={match.id} className="bg-white/5 border-white/5">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] text-accent font-bold uppercase tracking-widest">Court {match.court}</span>
                        <Badge variant="outline" className="h-4 text-[8px] uppercase">Live</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold truncate max-w-[100px]">{match.teamA.name}</span>
                        <span className="text-xl font-mono font-bold text-accent">{match.teamA.score}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold truncate max-w-[100px]">{match.teamB.name}</span>
                        <span className="text-xl font-mono font-bold opacity-50">{match.teamB.score}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="bg-card/50 border-white/5 p-8 text-center text-xs text-muted-foreground italic">
                  No matches currently live.
                </Card>
              )}
          </div>
        </div>
      </div>
    </div>
  )
}
