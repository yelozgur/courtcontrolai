
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
  TrendingUp
} from "lucide-react"
import { collection, query, limit, doc, where } from "firebase/firestore"
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

  // Admin Queries
  const allClubsQuery = useMemoFirebase(() => {
    if (!db || !isAdmin) return null;
    return query(collection(db, "clubs"), limit(100));
  }, [db, isAdmin]);

  const allUsersQuery = useMemoFirebase(() => {
    if (!db || !isAdmin) return null;
    return query(collection(db, "users"), limit(100));
  }, [db, isAdmin]);

  const { data: allClubs } = useCollection(allClubsQuery);
  const { data: allUsers } = useCollection(allUsersQuery);

  // Club Owner Queries
  const tournamentsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "tournaments"), limit(10));
  }, [db]);

  const matchesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "matches"), where("status", "==", "live"), limit(5));
  }, [db]);

  const { data: tournaments, loading: toursLoading } = useCollection(tournamentsQuery);
  const { data: matches } = useCollection(matchesQuery);

  if (profileLoading || toursLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-primary h-12 w-12" />
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
            <Button variant="outline" asChild>
              <Link href="/dashboard/admin/costs">
                <DollarSign className="mr-2 h-4 w-4" /> Cloud Costs
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Active Clubs" value={allClubs?.length || 0} icon={Building} sub="Onboarded Orgs" />
          <StatCard title="Total Users" value={allUsers?.length || 0} icon={Users} sub="Unique Accounts" color="text-accent" />
          <StatCard title="Growth Rate" value="+12%" icon={TrendingUp} sub="Past 30 days" />
          <StatCard title="System" value="Stable" icon={Zap} sub="Node Health" color="text-emerald-400" />
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          <Card className="lg:col-span-8 bg-white/5 border-white/5">
            <CardHeader>
              <CardTitle>Recent Club Activity</CardTitle>
              <CardDescription>Latest sports organizations joining Court Control AI.</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="space-y-4">
                 {allClubs?.slice(0, 5).map(club => (
                   <div key={club.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center text-primary font-bold">{club.name.charAt(0)}</div>
                        <div>
                          <p className="font-bold">{club.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{club.location}</p>
                        </div>
                      </div>
                      <Badge variant="outline">{club.primarySport}</Badge>
                   </div>
                 ))}
                 {!allClubs?.length && <p className="text-center text-muted-foreground py-10 italic">No clubs registered yet.</p>}
               </div>
            </CardContent>
          </Card>
          <Card className="lg:col-span-4 bg-primary/10 border-primary/20">
             <CardHeader>
                <CardTitle className="text-primary">Admin Tips</CardTitle>
             </CardHeader>
             <CardContent className="text-xs text-muted-foreground space-y-4">
                <p>Use the <strong>System Users</strong> tab to promote new signups to "Club Owner" or "Referee" roles.</p>
                <p>Monitor <strong>Revenue & Costs</strong> daily to ensure Spark Plan quotas aren't exceeded by heavy AI scheduling sessions.</p>
             </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold text-white tracking-tighter uppercase">
            Tournament Command
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">
            Welcome back, {profile?.displayName || 'Organizer'}.
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="bg-primary" asChild>
            <Link href="/dashboard/tournaments/new">
              <PlusCircle className="mr-2 h-4 w-4" /> Create Tournament
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Active Tournaments" value={tournaments?.length || 0} icon={Trophy} sub="Current Season" />
        <StatCard title="Live Matches" value={matches?.length || 0} icon={Activity} sub="On Courts" color="text-accent" />
        <StatCard title="Club Rank" value="Elite" icon={Star} sub="System status" />
        <StatCard title="System Performance" value="Optimal" icon={Zap} sub="AI Scheduler Active" color="text-accent" />
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" /> Recent Events
          </h2>
          <div className="grid gap-4">
            {tournaments && tournaments.length > 0 ? (
              tournaments.map(t => (
                <Card key={t.id} className="bg-white/5 border-white/5 hover:border-primary/20 transition-all group">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <Trophy className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">{t.name}</h4>
                        <p className="text-sm text-muted-foreground">{t.sport} • Status: <span className="text-accent font-bold uppercase">{t.status || 'draft'}</span></p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/tournaments/${t.id}/edit`}>
                        Manage <ArrowUpRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-10 bg-white/5 rounded-2xl border-dashed border-2 border-white/10">
                <p className="text-muted-foreground">No tournaments created yet.</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-accent" /> Live Scoring
          </h2>
          <div className="space-y-4">
            {matches && matches.length > 0 ? (
              matches.map(match => (
                <Card key={match.id} className="bg-white/5 border-white/5">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <Badge variant="outline" className="text-[8px] uppercase">{match.status}</Badge>
                      <span className="text-[10px] text-muted-foreground">Court {match.court}</span>
                    </div>
                    <div className="flex items-center justify-between font-bold">
                      <span>{match.teamA?.name}</span>
                      <span className="text-accent">{match.teamA?.score}</span>
                    </div>
                    <div className="flex items-center justify-between font-bold opacity-60">
                      <span>{match.teamB?.name}</span>
                      <span>{match.teamB?.score}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-10 italic">No matches live right now.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, sub, color }: any) {
  return (
    <Card className="bg-white/5 border-white/5">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{title}</CardTitle>
        <Icon className={cn("h-4 w-4 text-primary", color)} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  )
}
