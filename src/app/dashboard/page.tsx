
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
  Zap,
  Loader2,
  Calendar,
  Star,
  Gavel
} from "lucide-react"
import { collection, query, where, limit, doc } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection, useUser, useDoc } from "@/firebase"

export default function DashboardOverview() {
  const db = useFirestore()
  const { user } = useUser()

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);
  const { data: profile, loading: profileLoading } = useDoc(userProfileRef);

  const role = profile?.role || 'player';
  const isOwner = role === 'club_owner';
  const isReferee = role === 'referee';
  const isPlayer = role === 'player';

  // Contextual Data
  const clubQuery = useMemoFirebase(() => {
    if (!db || !user || !isOwner) return null;
    return query(collection(db, "clubs"), where("ownerId", "==", user.uid), limit(1));
  }, [db, user, isOwner]);
  const { data: clubs } = useCollection(clubQuery);
  const clubId = clubs?.[0]?.id;

  const tournamentQuery = useMemoFirebase(() => {
    if (!db) return null;
    if (isOwner && clubId) return query(collection(db, "tournaments"), where("clubId", "==", clubId));
    return query(collection(db, "tournaments"), limit(20));
  }, [db, clubId, isOwner]);

  const matchesQuery = useMemoFirebase(() => {
    if (!db) return null;
    if (isPlayer) return query(collection(db, "matches"), where("status", "==", "live"), limit(5));
    if (isReferee) return query(collection(db, "matches"), where("refereeId", "==", user?.uid), where("status", "==", "live"));
    return query(collection(db, "matches"), where("status", "==", "live"), limit(5));
  }, [db, isPlayer, isReferee, user]);

  const { data: tournaments, loading: toursLoading } = useCollection(tournamentQuery);
  const { data: matches } = useCollection(matchesQuery);

  if (profileLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary" /></div>

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold text-white tracking-tighter uppercase">
            {isOwner ? "Organizer Command" : isReferee ? "Officials Portal" : "Player Dashboard"}
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">
            Welcome back, {profile?.displayName || 'Competitor'}.
          </p>
        </div>
        <div className="flex gap-2">
          {isOwner && (
            <Button className="bg-primary" asChild>
              <Link href="/dashboard/tournaments/new"><PlusCircle className="mr-2 h-4 w-4" /> Create Tournament</Link>
            </Button>
          )}
          {isPlayer && (
            <Button variant="outline" asChild>
              <Link href="/tournaments">Find Competitions</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {isOwner ? (
          <>
            <StatCard title="Club Tournaments" value={tournaments?.length || 0} icon={Trophy} sub="Active season" />
            <StatCard title="Match Pulse" value={matches?.length || 0} icon={Activity} sub="Live on courts" color="text-accent" />
            <StatCard title="Staff Count" value="4" icon={Users} sub="Referees active" />
            <StatCard title="System Performance" value="Optimized" icon={Zap} sub="AI Scheduler active" color="text-accent" />
          </>
        ) : (
          <>
            <StatCard title="My Matches" value="12" icon={Activity} sub="Completed" />
            <StatCard title="Rank Score" value="1420" icon={Star} sub="Intermediate Tier" color="text-accent" />
            <StatCard title="Next Game" value="14:00" icon={Clock} sub="Today" />
            <StatCard title="Wins" value="8" icon={Trophy} sub="75% Win rate" color="text-accent" />
          </>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" /> {isOwner ? "Recent Tournaments" : "Current Competitions"}
          </h2>
          <div className="grid gap-4">
            {tournaments?.map(t => (
              <Card key={t.id} className="bg-white/5 border-white/5 hover:border-primary/20 transition-all group">
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <Trophy className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg">{t.name}</h4>
                      <p className="text-sm text-muted-foreground">{t.sport} • Stage: <span className="text-accent font-bold uppercase">{t.status}</span></p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={isOwner ? `/dashboard/tournaments/${t.id}/edit` : `/tournaments/${t.id}/register`}>
                      {isOwner ? "Manage" : "View"} <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-accent" /> {isReferee ? "My Assignments" : "Live Feed"}
          </h2>
          <div className="space-y-4">
            {matches?.map(match => (
              <Card key={match.id} className="bg-white/5 border-white/5">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <Badge variant="outline" className="text-[8px] uppercase">{match.status}</Badge>
                    <span className="text-[10px] text-muted-foreground">Court {match.court}</span>
                  </div>
                  <div className="flex items-center justify-between font-bold">
                    <span>{match.teamA.name}</span>
                    <span className="text-accent">{match.teamA.score}</span>
                  </div>
                  <div className="flex items-center justify-between font-bold opacity-60">
                    <span>{match.teamB.name}</span>
                    <span>{match.teamB.score}</span>
                  </div>
                  {isReferee && (
                    <Button className="w-full mt-4 h-8 text-xs bg-accent text-accent-foreground" asChild>
                      <Link href={`/referee/${match.tournamentId}`}>Score Match</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
            {matches?.length === 0 && (
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

function PlusCircle(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>;
}
