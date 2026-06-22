
"use client"

import Link from "next/link"
import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Trophy, 
  Activity, 
  Zap, 
  Loader2, 
  Calendar, 
  PlusCircle, 
  Building, 
  Users, 
  DollarSign, 
  TrendingUp, 
  ArrowRight, 
  QrCode, 
  ChevronRight 
} from "lucide-react"
import { collection, query, limit, doc, where, orderBy } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection, useUser, useDoc } from "@/firebase"
import { StatusBadge } from "@/components/ui/status-badge"
import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardOverview() {
  const db = useFirestore()
  const { user } = useUser()

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);
  
  const { data: profile, loading: profileLoading } = useDoc(userProfileRef);
  const isAdmin = profile?.role === 'admin';

  // 1. Resolve User's Club
  const userClubsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, "clubs"), where("ownerId", "==", user.uid), limit(1));
  }, [db, user]);

  const { data: userClubs, loading: clubsLoading } = useCollection(userClubsQuery);
  const clubData = userClubs?.[0];
  const clubId = clubData?.id;

  // 2. Scoped Queries for Club Metrics
  const tournamentsQuery = useMemoFirebase(() => {
    if (!db || !clubId) return null;
    // Removing orderBy temporarily to handle legacy documents without createdAt and prevent index-related permission confusion
    return query(
      collection(db, "tournaments"), 
      where("clubId", "==", clubId),
      limit(5)
    );
  }, [db, clubId]);

  const liveMatchesQuery = useMemoFirebase(() => {
    if (!db || !clubId) return null;
    return query(
      collection(db, "matches"), 
      where("clubId", "==", clubId),
      where("status", "==", "live"), 
      limit(4)
    );
  }, [db, clubId]);

  const participantsQuery = useMemoFirebase(() => {
    if (!db || !clubId) return null;
    return query(
      collection(db, "participants"),
      where("clubId", "==", clubId)
    );
  }, [db, clubId]);

  const { data: tournaments, loading: toursLoading } = useCollection(tournamentsQuery);
  const { data: matches, loading: matchesLoading } = useCollection(liveMatchesQuery);
  const { data: participants, loading: partsLoading } = useCollection(participantsQuery);

  // 3. Computed Metrics for THIS Club only
  const metrics = useMemo(() => {
    if (!participants) return { count: 0, revenue: 0 };
    const count = participants.length;
    const revenue = participants.reduce((acc, p) => acc + (p.paidAmount || 0), 0);
    return { count, revenue };
  }, [participants]);

  // Sort tournaments client-side to ensure stability regardless of missing fields
  const sortedTournaments = useMemo(() => {
    if (!tournaments) return [];
    return [...tournaments].sort((a, b) => {
      const dateA = a.createdAt?.seconds || 0;
      const dateB = b.createdAt?.seconds || 0;
      return dateB - dateA;
    });
  }, [tournaments]);

  if (profileLoading || clubsLoading) {
    return <DashboardSkeleton />;
  }

  if (!clubId && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-6 animate-in fade-in duration-700">
        <div className="w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center border border-primary/20">
          <Building className="h-10 w-10 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-headline font-bold">Initialize Your Hub</h2>
          <p className="text-muted-foreground max-w-sm mx-auto">To start managing tournaments and matches, you must first configure your club identity.</p>
        </div>
        <Button asChild size="lg" className="rounded-2xl font-bold h-14 px-10 shadow-xl shadow-primary/20">
          <Link href="/dashboard/club">Configure Club Identity</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <p className="text-sm font-bold text-primary uppercase tracking-[0.2em]">Management Console</p>
          <h1 className="text-4xl font-headline font-bold uppercase tracking-tighter leading-none">
            Tournament Command
          </h1>
          <p className="text-muted-foreground font-medium flex items-center gap-2">
            Operating: <span className="text-foreground font-bold">{clubData?.name || "SaaS Network"}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="rounded-xl border-border bg-card font-bold h-12" asChild>
            <Link href="/dashboard/check-in">
              <QrCode className="mr-2 h-4 w-4" /> Check In Player
            </Link>
          </Button>
          <Button className="rounded-xl font-bold h-12 px-6" asChild>
            <Link href="/dashboard/tournaments/new">
              <PlusCircle className="mr-2 h-4 w-4" /> Create Tournament
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Club Tournaments" value={tournaments?.length || 0} icon={Trophy} sub="Active Events" />
        <StatCard title="Live Matches" value={matches?.length || 0} icon={Activity} sub="Currently Scoring" />
        <StatCard title="Total Roster" value={partsLoading ? "..." : metrics.count} icon={Users} sub="Club Members" />
        <StatCard title="Gross Revenue" value={partsLoading ? "..." : `$${metrics.revenue.toLocaleString()}`} icon={DollarSign} sub="Total Earnings" />
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-headline font-bold uppercase flex items-center gap-3">
              <Calendar className="h-6 w-6 text-primary" /> Recent Events
            </h2>
            <Button variant="link" asChild className="font-bold text-primary p-0">
              <Link href="/dashboard/tournaments">View All <ChevronRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>

          <div className="grid gap-4">
            {toursLoading ? (
              [1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)
            ) : sortedTournaments.length > 0 ? (
              sortedTournaments.map(t => (
                <Card key={t.id} className="group hover:border-primary/50 transition-all rounded-2xl overflow-hidden border-border bg-card">
                  <Link href={`/dashboard/tournaments/${t.id}/edit`}>
                    <CardContent className="p-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                          <Trophy className="h-6 w-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-lg group-hover:text-primary transition-colors">{t.name}</h4>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <StatusBadge status={t.status} />
                            <span>{t.sport} • {t.startDate}</span>
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-transform translate-x-0 group-hover:translate-x-1" />
                    </CardContent>
                  </Link>
                </Card>
              ))
            ) : (
              <div className="p-12 text-center bg-muted/20 border-2 border-dashed rounded-3xl">
                <Trophy className="h-8 w-8 text-muted-foreground mx-auto mb-4 opacity-30" />
                <p className="text-muted-foreground font-medium">No active tournaments found.</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <h2 className="text-2xl font-headline font-bold uppercase flex items-center gap-3">
            <Activity className="h-6 w-6 text-primary" /> Live Now
          </h2>
          <div className="space-y-4">
            {matchesLoading ? (
               [1, 2].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)
            ) : matches && matches.length > 0 ? (
              matches.map(m => (
                <Card key={m.id} className="rounded-2xl border-border bg-card group hover:border-primary/40 transition-all">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-center mb-4">
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-none text-[8px] uppercase tracking-widest font-black px-2 py-0.5 animate-pulse">LIVE</Badge>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase">Court {m.court}</span>
                    </div>
                    <div className="space-y-3 font-bold text-sm">
                      <div className="flex justify-between items-center">
                        <span className="truncate max-w-[140px]">{m.teamA?.name}</span>
                        <span className="text-primary text-xl font-headline">{m.teamA?.score}</span>
                      </div>
                      <div className="h-px bg-border"></div>
                      <div className="flex justify-between items-center opacity-60">
                        <span className="truncate max-w-[140px]">{m.teamB?.name}</span>
                        <span className="text-xl font-headline">{m.teamB?.score}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="p-10 text-center bg-muted/20 border rounded-3xl">
                <Activity className="h-6 w-6 text-muted-foreground mx-auto mb-2 opacity-20" />
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Silence on Courts</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, sub }: any) {
  return (
    <Card className="rounded-2xl border-border bg-card relative overflow-hidden group hover:shadow-lg transition-all">
      <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <CardHeader className="pb-2 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{title}</p>
          <div className="p-1.5 bg-primary/10 rounded-lg text-primary group-hover:scale-110 transition-transform">
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <CardTitle className="text-3xl font-headline font-bold">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-emerald-500" /> {sub}
        </p>
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-10 animate-pulse">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
    </div>
  )
}
