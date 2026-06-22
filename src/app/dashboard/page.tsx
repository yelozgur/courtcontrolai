
"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Trophy, 
  Activity, 
  ArrowUpRight,
  Zap,
  Loader2,
  Calendar,
  Star,
  PlusCircle,
  Building,
  Users,
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Handshake,
  ArrowRight
} from "lucide-react"
import { collection, query, limit, doc, where, orderBy } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection, useUser, useDoc } from "@/firebase"
import { cn } from "@/lib/utils"

export default function DashboardOverview() {
  const db = useFirestore()
  const { user } = useUser()

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);
  
  const { data: profile, loading: profileLoading } = useDoc(userProfileRef);
  const isAdmin = profile?.role === 'admin' || user?.email?.toLowerCase() === 'admin@deneme.com';

  // 1. Resolve the User's Club first to ensure strict isolation
  const userClubsQuery = useMemoFirebase(() => {
    if (!db || !user || isAdmin) return null;
    return query(collection(db, "clubs"), where("ownerId", "==", user.uid), limit(1));
  }, [db, user, isAdmin]);

  const { data: userClubs, loading: clubsLoading } = useCollection(userClubsQuery);
  const clubId = userClubs?.[0]?.id;

  // Admin Queries
  const allClubsQuery = useMemoFirebase(() => {
    if (!db || !isAdmin) return null;
    return query(collection(db, "clubs"), orderBy("createdAt", "desc"), limit(10));
  }, [db, isAdmin]);

  const allUsersQuery = useMemoFirebase(() => {
    if (!db || !isAdmin) return null;
    return query(collection(db, "users"), orderBy("createdAt", "desc"), limit(10));
  }, [db, isAdmin]);

  const { data: allClubs } = useCollection(allClubsQuery);
  const { data: allUsers } = useCollection(allUsersQuery);

  // Scoped Queries for Club Owners
  const tournamentsQuery = useMemoFirebase(() => {
    if (!db || !clubId) return null;
    return query(
      collection(db, "tournaments"), 
      where("clubId", "==", clubId),
      orderBy("createdAt", "desc"), 
      limit(5)
    );
  }, [db, clubId]);

  const liveMatchesQuery = useMemoFirebase(() => {
    if (!db || !clubId) return null;
    return query(
      collection(db, "matches"), 
      where("clubId", "==", clubId),
      where("status", "==", "live"), 
      limit(3)
    );
  }, [db, clubId]);

  const { data: tournaments, loading: toursLoading } = useCollection(tournamentsQuery);
  const { data: matches } = useCollection(liveMatchesQuery);

  if (profileLoading || (isAdmin ? false : (clubsLoading || (clubId && toursLoading)))) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="animate-spin text-primary h-12 w-12" />
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Syncing Environment...</p>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="space-y-8 animate-in fade-in duration-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-headline font-bold text-white tracking-tighter uppercase">Platform Master</h1>
            <p className="text-muted-foreground mt-1 font-medium">Global system status and SaaS metrics.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild className="border-accent text-accent hover:bg-accent/10">
              <Link href="/dashboard/admin/costs">
                <DollarSign className="mr-2 h-4 w-4" /> Cloud Costs
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Recent Clubs" value={allClubs?.length || 0} icon={Building} sub="Onboarded Orgs" />
          <StatCard title="Recent Users" value={allUsers?.length || 0} icon={Users} sub="Unique Accounts" color="text-accent" />
          <StatCard title="Growth Rate" value="+12%" icon={TrendingUp} sub="Past 30 days" />
          <StatCard title="System" value="Stable" icon={Zap} sub="Node Health" color="text-emerald-400" />
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-6">
            <Card className="bg-white/5 border-white/5">
              <CardHeader>
                <CardTitle>Recent Club Activity</CardTitle>
                <CardDescription>Latest sports organizations joining Court Control AI.</CardDescription>
              </CardHeader>
              <CardContent>
                 <div className="space-y-4">
                   {allClubs?.map(club => (
                     <div key={club.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center text-primary font-bold">{club.name?.charAt(0) || 'C'}</div>
                          <div>
                            <p className="font-bold">{club.name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">{club.location || 'Global'}</p>
                          </div>
                        </div>
                        <Badge variant="outline">{club.primarySport}</Badge>
                     </div>
                   ))}
                   {!allClubs?.length && <p className="text-center text-muted-foreground py-10 italic">No clubs registered yet.</p>}
                 </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!clubId && !clubsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 animate-in fade-in duration-700">
        <div className="w-20 h-20 bg-secondary rounded-[2rem] flex items-center justify-center">
          <Building className="h-10 w-10 text-muted-foreground opacity-50" />
        </div>
        <div>
          <h2 className="text-3xl font-headline font-bold uppercase tracking-tighter">Initialize Your Hub</h2>
          <p className="text-muted-foreground max-w-xs mx-auto mt-2">To start managing tournaments, you must first register your club profile.</p>
        </div>
        <Button asChild size="lg" className="bg-primary font-bold px-10 rounded-2xl">
          <Link href="/dashboard/club">Configure Club Identity</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-5xl font-headline font-bold text-white tracking-tighter uppercase leading-none">
            TOURNAMENT COMMAND
          </h1>
          <p className="text-muted-foreground mt-2 font-medium flex items-center gap-2">
            Managing: <span className="text-primary font-bold">{userClubs?.[0]?.name}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="bg-primary hover:bg-primary/90 h-12 rounded-xl px-6 font-bold text-sm flex items-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95" asChild>
            <Link href="/dashboard/tournaments/new">
              <PlusCircle className="h-5 w-5" /> Create Tournament
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Club Tournaments" value={tournaments?.length || 0} icon={Trophy} sub="Owned Events" />
        <StatCard title="Live Matches" value={matches?.length || 0} icon={Activity} sub="At Your Venues" color="text-accent" />
        <StatCard title="Club Rank" value="Verified" icon={Star} sub="System status" color="text-amber-400" />
        <StatCard title="System Performance" value="Optimal" icon={Zap} sub="AI Scheduler Active" color="text-accent" />
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          <h2 className="text-2xl font-headline font-bold flex items-center gap-3 text-white uppercase tracking-tighter">
            <Calendar className="h-6 w-6 text-primary" /> Recent Events
          </h2>
          <div className="grid gap-4">
            {tournaments && tournaments.length > 0 ? (
              tournaments.map(t => (
                <Card key={t.id} className="bg-white/5 border-white/5 hover:border-primary/20 transition-all group overflow-hidden">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-secondary/30 rounded-xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform border border-white/5">
                        <Trophy className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-white">{t.name}</h4>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                          {t.sport} • Status: <span className="text-accent font-black">{t.status?.toUpperCase() || 'DRAFT'}</span>
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" asChild className="hover:bg-primary/10 hover:text-primary">
                      <Link href={`/dashboard/tournaments/${t.id}/edit`}>
                        Manage <ArrowUpRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-20 bg-white/5 rounded-3xl border-dashed border-2 border-white/10">
                <p className="text-muted-foreground text-sm font-bold uppercase tracking-widest opacity-40">No tournaments created yet.</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <h2 className="text-2xl font-headline font-bold flex items-center gap-3 text-white uppercase tracking-tighter">
            <Activity className="h-6 w-6 text-accent" /> Live Scoring
          </h2>
          <div className="space-y-4">
            {matches && matches.length > 0 ? (
              matches.map(match => (
                <Card key={match.id} className="bg-white/5 border-white/5 backdrop-blur-md">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-3">
                      <Badge variant="secondary" className="bg-primary/20 text-primary border-none text-[8px] uppercase tracking-widest font-bold px-2 py-0.5">LIVE</Badge>
                      <span className="text-[9px] text-muted-foreground font-mono font-bold uppercase">Court {match.court}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between font-bold text-sm">
                        <span className="text-white">{match.teamA?.name}</span>
                        <span className="text-accent font-mono text-lg">{match.teamA?.score}</span>
                      </div>
                      <div className="flex items-center justify-between font-bold text-sm opacity-50">
                        <span className="text-white">{match.teamB?.name}</span>
                        <span className="text-white font-mono text-lg">{match.teamB?.score}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="p-10 text-center bg-white/5 rounded-3xl border border-white/5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic opacity-30">No matches live</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, sub, color }: any) {
  return (
    <Card className="bg-card/50 border-white/5 hover:border-primary/20 transition-all group relative overflow-hidden">
      <div className={cn("absolute -right-2 -top-2 opacity-5 transition-transform group-hover:scale-125 group-hover:rotate-12", color)}>
        <Icon className="h-20 w-20" />
      </div>
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">{title}</CardTitle>
        <Icon className={cn("h-4 w-4", color)} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-headline font-bold text-white tracking-tighter">{value}</div>
        <p className="text-[10px] text-muted-foreground mt-1 font-medium">{sub}</p>
      </CardContent>
    </Card>
  )
}
