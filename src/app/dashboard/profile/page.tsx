"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useUser, useFirestore, useMemoFirebase, useCollection, useDoc } from "@/firebase"
import { collection, query, where, orderBy, doc, limit } from "firebase/firestore"
import { 
  Trophy, 
  Calendar, 
  CheckCircle, 
  Clock, 
  MapPin, 
  User, 
  Mail, 
  Award, 
  Loader2, 
  TrendingUp, 
  Star, 
  Users, 
  Zap,
  ChevronRight,
  ShieldCheck,
  Building
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import { cn } from "@/lib/utils"

export default function PlayerProfile() {
  const { user } = useUser()
  const db = useFirestore()

  // 1. Get User Profile
  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, "users", user.uid)
  }, [db, user])
  const { data: profile } = useDoc(userProfileRef)

  // 2. Get User's Club (if they are an owner)
  const clubQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "clubs"), where("ownerId", "==", user.uid), limit(1))
  }, [db, user])
  const { data: userClubs } = useCollection(clubQuery)
  const ownedClub = userClubs?.[0]

  // 3. Get Player Registrations (linked by email)
  const registrationsQuery = useMemoFirebase(() => {
    if (!db || !user?.email) return null
    return query(
      collection(db, "participants"),
      where("email", "==", user.email.toLowerCase())
    )
  }, [db, user])
  const { data: registrations, loading: regsLoading } = useCollection(registrationsQuery)

  // 4. Get Club Leaderboard (to calculate rank)
  // For MVP, we'll fetch all participants from the user's primary club to show relative rank
  const clubId = registrations?.[0]?.clubId || ownedClub?.id
  const clubLeaderboardQuery = useMemoFirebase(() => {
    if (!db || !clubId) return null
    return query(collection(db, "participants"), where("clubId", "==", clubId))
  }, [db, clubId])
  const { data: clubParticipants } = useCollection(clubLeaderboardQuery)

  // 5. Get Check-In History
  const checkinsQuery = useMemoFirebase(() => {
    if (!db || !registrations || registrations.length === 0) return null
    const participantIds = registrations.map(r => r.id)
    return query(
      collection(db, "checkins"),
      where("participantId", "in", participantIds.slice(0, 10)),
      orderBy("timestamp", "desc")
    )
  }, [db, registrations])
  const { data: checkins, loading: checkinsLoading } = useCollection(checkinsQuery)

  // STATS CALCULATION
  const stats = useMemo(() => {
    if (!registrations) return { points: 0, rank: 0, level: 'Novice', progress: 0 }
    
    // Simple MVP Ranking Logic: 
    // Participation = 100pts, Pro skill = +50pts, Intermediate = +20pts
    const points = registrations.reduce((acc, reg) => {
      let val = 100
      if (reg.skillLevel === 'pro') val += 50
      if (reg.skillLevel === 'intermediate') val += 20
      return acc + val
    }, 0)

    // Rank calculation within club
    let rank = 0
    if (clubParticipants && user?.email) {
      const sorted = [...clubParticipants].sort((a, b) => {
        // Mock points for others too
        const getPts = (p: any) => (p.verified ? 100 : 50) + (p.skillLevel === 'pro' ? 50 : 20)
        return getPts(b) - getPts(a)
      })
      rank = sorted.findIndex(p => p.email.toLowerCase() === user.email?.toLowerCase()) + 1
    }

    const level = points > 500 ? 'Elite' : points > 200 ? 'Competitor' : 'Novice'
    const progress = (points % 200) / 2

    return { points, rank, level, progress }
  }, [registrations, clubParticipants, user?.email])

  if (!user) return null

  const isAdmin = profile?.role === 'admin'
  const isClubOwner = !!ownedClub

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* HEADER SECTION */}
      <div className="relative overflow-hidden p-8 bg-card/30 rounded-[2.5rem] border border-white/5 backdrop-blur-xl">
        <Zap className="absolute -right-10 -top-10 h-64 w-64 text-primary/5 rotate-12" />
        
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div className="relative">
            <div className="w-32 h-32 bg-gradient-to-br from-primary to-accent rounded-[2rem] flex items-center justify-center text-5xl font-bold shadow-2xl shadow-primary/20">
              {profile?.displayName?.charAt(0) || user.email?.charAt(0).toUpperCase()}
            </div>
            <div className="absolute -bottom-2 -right-2 bg-emerald-500 p-2 rounded-full border-4 border-[#0F172A]">
               <CheckCircle className="h-5 w-5 text-white" />
            </div>
          </div>
          
          <div className="text-center md:text-left flex-1 space-y-2">
            <div className="flex flex-wrap justify-center md:justify-start items-center gap-3">
              <h1 className="text-4xl font-headline font-bold text-white uppercase tracking-tighter">
                {profile?.displayName || "Competitor"}
              </h1>
              <Badge variant="outline" className="border-accent/40 text-accent bg-accent/5 px-3 py-1 font-bold uppercase tracking-widest text-[10px]">
                {stats.level} Level
              </Badge>
            </div>
            
            <div className="flex flex-wrap justify-center md:justify-start gap-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Mail className="h-4 w-4" /> {user.email}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Building className="h-4 w-4" /> {ownedClub?.name || registrations?.[0]?.clubName || "Global Circuit"}
              </div>
            </div>

            <div className="pt-4 flex flex-wrap justify-center md:justify-start gap-3">
              {isClubOwner && <Badge className="bg-primary text-white">CLUB OWNER</Badge>}
              {isAdmin && <Badge className="bg-accent text-accent-foreground">SYSTEM ADMIN</Badge>}
              {registrations && registrations.length > 0 && <Badge variant="secondary" className="bg-white/5 border-white/10">ACTIVE PLAYER</Badge>}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 min-w-[200px] text-center space-y-4">
             <div>
               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Ranking Points</p>
               <p className="text-4xl font-headline font-bold text-primary">{stats.points}</p>
             </div>
             <div className="space-y-1">
                <div className="flex justify-between text-[8px] font-bold uppercase text-muted-foreground">
                  <span>Next Level</span>
                  <span>{Math.round(stats.progress)}%</span>
                </div>
                <Progress value={stats.progress} className="h-1.5 bg-white/10" />
             </div>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* LEFT COLUMN: PLAYER STATS & HISTORY */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* STATS TILES */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card className="bg-white/5 border-white/5">
              <CardContent className="p-6">
                <Trophy className="h-5 w-5 text-amber-400 mb-2" />
                <p className="text-3xl font-headline font-bold">{stats.rank || '--'}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Club Rank</p>
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/5">
              <CardContent className="p-6">
                <Calendar className="h-5 w-5 text-primary mb-2" />
                <p className="text-3xl font-headline font-bold">{registrations?.length || 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Events Joined</p>
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/5 col-span-2 md:col-span-1">
              <CardContent className="p-6">
                <TrendingUp className="h-5 w-5 text-accent mb-2" />
                <p className="text-3xl font-headline font-bold">{checkins?.length || 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Total Matches</p>
              </CardContent>
            </Card>
          </div>

          {/* TOURNAMENTS LIST */}
          <div className="space-y-4">
            <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
              <Star className="h-6 w-6 text-primary" /> My Tournament Circuit
            </h2>
            
            {regsLoading ? (
              <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>
            ) : registrations && registrations.length > 0 ? (
              <div className="grid gap-4">
                {registrations.map((reg) => (
                  <Card key={reg.id} className="bg-white/5 border-white/5 hover:border-primary/20 transition-all group">
                    <CardContent className="p-6 flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-secondary rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                          <Award className="h-8 w-8" />
                        </div>
                        <div>
                          <h4 className="font-bold text-lg group-hover:text-primary transition-colors">{reg.categoryName || "Open Bracket"}</h4>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1 font-bold text-accent uppercase tracking-widest">
                               <Zap className="h-3 w-3" /> {reg.skillLevel || 'Intermediate'}
                            </span>
                            <span>•</span>
                            <span>Registered: {new Date(reg.registeredAt?.seconds * 1000).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-6">
                         <div className="hidden md:block">
                            <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-widest border-primary/20 text-primary mb-1">In Roster</Badge>
                            <p className="text-[10px] text-muted-foreground font-mono">#{reg.id.slice(-6).toUpperCase()}</p>
                         </div>
                         <Button variant="ghost" size="icon" className="group-hover:bg-primary group-hover:text-white transition-all rounded-full" asChild>
                            <Link href={`/tournaments/${reg.tournamentId}/register`}><ChevronRight className="h-5 w-5" /></Link>
                         </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-card/50 border-white/5 border-dashed py-20 text-center">
                <CardContent className="space-y-4">
                  <div className="w-16 h-16 bg-secondary/30 rounded-full flex items-center justify-center mx-auto mb-4 opacity-30">
                    <Trophy className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold uppercase tracking-tighter">No Active Competitions</h3>
                  <p className="text-muted-foreground max-w-xs mx-auto text-sm">
                    You haven't registered for any tournaments yet. Join an arena to start building your global ranking.
                  </p>
                  <Button asChild className="bg-primary hover:bg-primary/90 mt-4">
                    <Link href="/tournaments">Find Your First Arena</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: LEADERBOARD & ACTIVITY */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* CLUB LEADERBOARD SUMMARY */}
          <Card className="bg-[#1E293B] border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
            <CardHeader className="bg-primary/10 border-b border-white/5">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Club Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-white/5">
                {clubParticipants ? clubParticipants.slice(0, 5).map((player, idx) => (
                  <div key={player.id} className={cn(
                    "flex items-center justify-between p-4 px-6",
                    player.email.toLowerCase() === user.email?.toLowerCase() ? "bg-primary/10 border-l-4 border-primary" : ""
                  )}>
                    <div className="flex items-center gap-4">
                      <span className={cn(
                        "font-mono text-sm font-bold w-4",
                        idx === 0 ? "text-amber-400" : idx === 1 ? "text-slate-300" : idx === 2 ? "text-orange-400" : "text-muted-foreground"
                      )}>{idx + 1}</span>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">{player.name}</span>
                        <span className="text-[10px] uppercase text-muted-foreground">{player.skillLevel}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] font-bold border-white/10">
                      {player.verified ? 'VERIFIED' : 'PENDING'}
                    </Badge>
                  </div>
                )) : (
                  <p className="p-8 text-center text-xs text-muted-foreground italic">No club rankings available.</p>
                )}
              </div>
              <div className="p-4 border-t border-white/5">
                <Button variant="ghost" className="w-full text-xs text-muted-foreground hover:text-white" asChild>
                  <Link href="/dashboard/participants">View Full Club Roster <ChevronRight className="h-3 w-3 ml-2" /></Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ARRIVAL HISTORY */}
          <div className="space-y-4">
            <h2 className="text-xl font-headline font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-accent" /> Arrival Log
            </h2>
            <div className="space-y-4">
              {checkinsLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-accent" /></div>
              ) : checkins && checkins.length > 0 ? (
                checkins.map((check) => (
                  <Card key={check.id} className="bg-white/5 border-white/5 group hover:bg-white/10 transition-all">
                    <CardContent className="p-4 flex items-start gap-4">
                      <div className="p-2.5 bg-emerald-500/20 rounded-2xl group-hover:scale-110 transition-transform">
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-white uppercase tracking-tight">Verified Arrival</p>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3 text-accent" /> {check.location}
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-1 font-mono uppercase">
                          {check.timestamp?.toDate ? check.timestamp.toDate().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Just now"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="p-10 text-center bg-white/5 rounded-3xl border border-white/5">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest italic opacity-50"> No check-in history yet</p>
                </div>
              )}
            </div>
          </div>

          {/* MANAGEMENT QUICK LINK FOR OWNERS */}
          {isClubOwner && (
            <Card className="bg-accent/10 border-accent/20 border">
               <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent/20 rounded-xl">
                      <ShieldCheck className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Manager Perspective</p>
                      <p className="text-[10px] text-muted-foreground uppercase">You are managing {ownedClub.name}</p>
                    </div>
                  </div>
                  <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" asChild>
                    <Link href="/dashboard/club">Club Command Console</Link>
                  </Button>
               </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
