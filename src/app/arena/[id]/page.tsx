"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Trophy, Zap, Clock, Users, ArrowLeft, Loader2, CheckCircle, AlertCircle, MapPin, Calendar, Activity, Globe } from "lucide-react"
import { collection, query, where, limit, doc } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection, useDoc } from "@/firebase"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { format } from "date-fns"

export default function TournamentArena() {
  const { id } = useParams()
  const router = useRouter()
  const [time, setTime] = useState<Date | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<string>("all")
  const db = useFirestore()

  const tournamentRef = useMemoFirebase(() => {
    if (!db || !id) return null
    return doc(db, "tournaments", id as string)
  }, [db, id])

  const { data: tournament, loading: tourneyLoading } = useDoc(tournamentRef)

  // Fetch club to get the correct timezone
  const clubRef = useMemoFirebase(() => {
    if (!db || !tournament?.clubId) return null
    return doc(db, "clubs", tournament.clubId)
  }, [db, tournament?.clubId])
  const { data: club } = useDoc(clubRef)
  
  const clubTimezone = club?.timezone || "UTC"

  useEffect(() => {
    // Synchronize Arena clock with venue time
    setTime(new Date())
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const allMatchesQuery = useMemoFirebase(() => {
    if (!db || !id) return null
    return query(
      collection(db, "matches"), 
      where("tournamentId", "==", id),
      limit(200)
    )
  }, [db, id])

  const { data: allMatches, loading: matchesLoading, error: matchesError } = useCollection(allMatchesQuery)

  const liveMatches = useMemo(() => {
    if (!allMatches) return []
    let filtered = allMatches.filter(m => m.status === "live")
    if (selectedLocation !== "all") {
      filtered = filtered.filter(m => {
        const locName = typeof m.location === 'object' ? m.location.name : m.location;
        return locName === selectedLocation;
      })
    }
    return filtered.slice(0, 6)
  }, [allMatches, selectedLocation])

  const finishedMatches = useMemo(() => {
    if (!allMatches) return []
    let filtered = allMatches.filter(m => m.status === "completed")
    if (selectedLocation !== "all") {
      filtered = filtered.filter(m => {
        const locName = typeof m.location === 'object' ? m.location.name : m.location;
        return locName === selectedLocation;
      })
    }
    return filtered
      .sort((a, b) => {
        const timeA = a.completedAt ? new Date(a.completedAt).getTime() : 0
        const timeB = b.completedAt ? new Date(b.completedAt).getTime() : 0
        return timeB - timeA
      })
      .slice(0, 3)
  }, [allMatches, selectedLocation])

  const upcomingMatches = useMemo(() => {
    if (!allMatches) return []
    let filtered = allMatches.filter(m => m.status === "scheduled")
    if (selectedLocation !== "all") {
      filtered = filtered.filter(m => {
        const locName = typeof m.location === 'object' ? m.location.name : m.location;
        return locName === selectedLocation;
      })
    }
    return filtered
      .sort((a, b) => {
        const aStart = a.startTime ? new Date(a.startTime).getTime() : 0
        const bStart = b.startTime ? new Date(b.startTime).getTime() : 0
        return aStart - bStart
      })
      .slice(0, 4)
  }, [allMatches, selectedLocation])

  // Helper to format time in club timezone
  const formatVenueTime = (date: Date) => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: clubTimezone
    });
  }

  const formatVenueDate = (date: Date) => {
    return date.toLocaleDateString([], { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric',
      timeZone: clubTimezone
    });
  }

  if (matchesError) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-6 text-white text-center">
        <AlertCircle className="h-16 w-16 text-destructive mb-4 opacity-50" />
        <h2 className="text-3xl font-headline font-bold uppercase">Arena Restricted</h2>
        <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
          We encountered an error loading live results. Please check security rules or connection.
        </p>
        <Button onClick={() => window.location.reload()} variant="outline" className="mt-8">Retry Connection</Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-white p-8 font-body overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-6">
          <Button variant="ghost" size="icon" onClick={() => router.push("/arena")} className="text-white hover:bg-white/10">
            <ArrowLeft className="h-8 w-8" />
          </Button>
          <div className="w-16 h-16 bg-[#8B5CF6] rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
            <Zap className="h-10 w-10 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-headline font-bold tracking-tighter uppercase">
              {tourneyLoading ? "Connecting..." : (tournament?.name || "Live Arena")}
            </h1>
            {/* Fix hydration error by using div instead of p for block-level Badge descendants */}
            <div className="text-xl text-muted-foreground font-medium uppercase tracking-widest flex items-center gap-2">
              Real-time Scoring Dashboard <Badge variant="outline" className="text-[10px] border-accent/30 text-accent font-mono"><Globe className="h-3 w-3 mr-1" /> {clubTimezone}</Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-12">
          <div className="w-64">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
              <MapPin className="h-3 w-3" /> Venue Selection
            </p>
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white h-12">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {tournament?.locations?.map((loc: any, i: number) => (
                  <SelectItem key={i} value={typeof loc === 'object' ? loc.name : loc}>
                    {typeof loc === 'object' ? loc.name : loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="text-right">
            <div className="text-xs font-bold text-accent uppercase tracking-[0.3em] mb-1 flex items-center justify-end gap-2 h-4">
              {time && (
                <>
                  <Calendar className="h-3 w-3" />
                  {formatVenueDate(time)}
                </>
              )}
            </div>
            <div className="text-5xl font-mono font-bold leading-none h-12">
              {time ? formatVenueTime(time) : "--:--"}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8 flex-1 overflow-hidden">
        <div className="col-span-2 space-y-8 overflow-y-auto pr-4 scrollbar-hide">
          <h2 className="text-3xl font-headline font-bold flex items-center gap-4">
            <span className="w-4 h-4 rounded-full bg-accent animate-pulse"></span>
            Live On Courts {selectedLocation !== "all" && <span className="text-muted-foreground text-xl font-normal">at {selectedLocation}</span>}
          </h2>
          
          <div className="grid gap-6">
            {matchesLoading ? (
              <div className="flex items-center justify-center p-20">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            ) : liveMatches.length > 0 ? (
              liveMatches.map((match) => (
                <div key={match.id} className="bg-card/40 border border-white/5 rounded-3xl p-8 flex items-center gap-12 backdrop-blur-md relative overflow-hidden group">
                  <div className="absolute top-0 left-0 h-full w-2 bg-accent"></div>
                  
                  <div className="text-center w-24">
                    <span className="block text-sm text-muted-foreground uppercase font-bold tracking-[0.2em] mb-2">Court</span>
                    <span className="block text-7xl font-headline font-bold">{match.court}</span>
                  </div>

                  <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-2xl font-bold">
                          {match.teamA.name?.substring(0, 2).toUpperCase() || "??"}
                        </div>
                        <span className="text-3xl font-bold">{match.teamA.name}</span>
                      </div>
                      <div className="flex items-center gap-8">
                        <span className="text-2xl font-mono font-bold text-muted-foreground">({match.teamA.setsWon || 0})</span>
                        <span className="text-6xl font-mono font-bold text-accent">{match.teamA.score}</span>
                      </div>
                    </div>
                    <div className="h-px bg-white/5"></div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-2xl font-bold">
                          {match.teamB.name?.substring(0, 2).toUpperCase() || "??"}
                        </div>
                        <span className="text-3xl font-bold">{match.teamB.name}</span>
                      </div>
                      <div className="flex items-center gap-8">
                        <span className="text-2xl font-mono font-bold text-muted-foreground">({match.teamB.setsWon || 0})</span>
                        <span className="text-6xl font-mono font-bold opacity-50">{match.teamB.score}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right pl-12 border-l border-white/5 min-w-[150px]">
                    <Badge className="bg-primary/20 text-primary border-primary mb-2 text-sm px-4 py-1 uppercase">{match.category}</Badge>
                    <p className="text-muted-foreground font-mono text-xs mb-1 uppercase tracking-widest">{typeof match.location === 'object' ? match.location.name : (match.location || 'Main Venue')}</p>
                    <p className="text-accent font-bold font-mono">LIVE</p>
                  </div>
                </div>
              ))
            ) : upcomingMatches.length > 0 ? (
              <div className="space-y-6">
                 <div className="bg-card/40 border border-white/5 rounded-3xl p-12 text-center">
                    <p className="text-xl text-muted-foreground mb-8">No matches currently in progress. Showing upcoming scheduled matches.</p>
                    <div className="grid gap-4">
                       {upcomingMatches.map(m => (
                         <div key={m.id} className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-white/5">
                            <div className="flex items-center gap-6">
                               <div className="bg-secondary/30 p-3 rounded-xl text-center min-w-[80px]">
                                  <Clock className="h-4 w-4 mx-auto mb-1 text-primary" />
                                  <span className="text-sm font-bold">{m.startTime ? (typeof m.startTime === 'string' ? m.startTime.split('T')[1]?.substring(0, 5) : formatVenueTime(m.startTime.toDate())) : 'TBD'}</span>
                               </div>
                               <div className="text-left">
                                  <p className="text-xl font-bold">{m.teamA.name} vs {m.teamB.name}</p>
                                  <p className="text-xs text-muted-foreground uppercase tracking-widest">{m.category} • Court {m.court}</p>
                               </div>
                            </div>
                            <Badge variant="outline" className="text-accent border-accent/20">READY</Badge>
                         </div>
                       ))}
                    </div>
                 </div>
              </div>
            ) : (
              <div className="bg-card/40 border border-white/5 rounded-3xl p-20 text-center">
                <p className="text-2xl text-muted-foreground">No matches scheduled or live {selectedLocation !== "all" ? `at ${selectedLocation}` : "in this arena"}.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8 overflow-y-auto pr-2 scrollbar-hide">
          <div className="bg-[#1E293B] rounded-3xl p-8 border border-white/5">
            <h2 className="text-2xl font-headline font-bold mb-8 flex items-center gap-4 text-accent">
              <CheckCircle className="h-6 w-6" />
              Recent Results
            </h2>
            <div className="space-y-6">
              {matchesLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
              ) : finishedMatches.length > 0 ? (
                finishedMatches.map((m) => (
                  <div key={m.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 animate-in fade-in duration-500">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{m.category}</span>
                        <span className="text-[8px] uppercase text-muted-foreground/60">{typeof m.location === 'object' ? m.location.name : m.location}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] h-5 border-emerald-500/30 text-emerald-400">FINAL</Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className={(m.teamA.setsWon || 0) > (m.teamB.setsWon || 0) ? "font-bold text-white" : "text-muted-foreground"}>
                          {m.teamA.name}
                        </span>
                        <span className="font-mono font-bold text-accent">{m.teamA.setsWon || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={(m.teamB.setsWon || 0) > (m.teamA.setsWon || 0) ? "font-bold text-white" : "text-muted-foreground"}>
                          {m.teamB.name}
                        </span>
                        <span className="font-mono font-bold text-accent">{m.teamB.setsWon || 0}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground italic py-10 text-sm">No matches finished yet.</p>
              )}
            </div>
          </div>
          <div className="bg-[#1E293B]/50 rounded-3xl p-8 border border-white/5">
            <div className="bg-primary/10 rounded-3xl p-6 text-center">
                <Activity className="h-10 w-10 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-headline font-bold">Arena Hub</h3>
                <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
                  Real-time court assignments and automated scheduling powered by Court Control AI.
                </p>
                <div className="mt-6 flex justify-center opacity-40">
                  <div className="w-24 h-24 bg-white rounded-xl p-2">
                     <svg viewBox="0 0 24 24" fill="black"><path d="M3 3h7v7H3zm2 2v3h3V5zm8-2h7v7h-7zm2 2v3h3V5zM3 14h7v7H3zm2 2v3h3v-3zm10 0h2v2h-2zm2 2h2v2h-2zm-2 2h2v2h-2zm4-2h2v2h-2zm0-4h2v2h-2z"/></svg>
                  </div>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
