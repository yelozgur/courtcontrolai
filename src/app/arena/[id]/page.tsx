
"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Trophy, Zap, Clock, Users, ArrowLeft, Loader2, CheckCircle } from "lucide-react"
import { collection, query, where, limit, doc, orderBy } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection, useDoc } from "@/firebase"
import { Button } from "@/components/ui/button"

export default function TournamentArena() {
  const { id } = useParams()
  const router = useRouter()
  const [time, setTime] = useState<Date | null>(null)
  const db = useFirestore()

  useEffect(() => {
    setTime(new Date())
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const tournamentRef = useMemoFirebase(() => {
    if (!db || !id) return null
    return doc(db, "tournaments", id as string)
  }, [db, id])

  const { data: tournament } = useDoc(tournamentRef)

  const liveMatchesQuery = useMemoFirebase(() => {
    if (!db || !id) return null
    return query(
      collection(db, "matches"), 
      where("tournamentId", "==", id),
      where("status", "==", "live"),
      limit(4)
    )
  }, [db, id])

  const finishedMatchesQuery = useMemoFirebase(() => {
    if (!db || !id) return null
    return query(
      collection(db, "matches"), 
      where("tournamentId", "==", id),
      where("status", "==", "completed"),
      orderBy("completedAt", "desc"),
      limit(3)
    )
  }, [db, id])

  const { data: liveMatches, loading: liveLoading } = useCollection(liveMatchesQuery)
  const { data: finishedMatches, loading: finishedLoading } = useCollection(finishedMatchesQuery)

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
              {tournament?.name || "Loading Arena..."}
            </h1>
            <p className="text-xl text-muted-foreground font-medium uppercase tracking-widest">
              Live Results Arena
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-5xl font-mono font-bold">
            {time ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
          </div>
          <div className="text-xl text-accent font-bold uppercase tracking-widest mt-1">Arena Mode Active</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8 flex-1 overflow-hidden">
        <div className="col-span-2 space-y-8 overflow-y-auto pr-4">
          <h2 className="text-3xl font-headline font-bold flex items-center gap-4">
            <span className="w-4 h-4 rounded-full bg-accent animate-pulse"></span>
            Live On Courts
          </h2>
          
          <div className="grid gap-6">
            {liveLoading ? (
              <div className="flex items-center justify-center p-20">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            ) : liveMatches && liveMatches.length > 0 ? (
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

                  <div className="text-right pl-12 border-l border-white/5">
                    <Badge className="bg-primary/20 text-primary border-primary mb-4 text-lg px-6 py-2 uppercase">{match.category}</Badge>
                    <p className="text-muted-foreground font-mono">LIVE</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-card/40 border border-white/5 rounded-3xl p-20 text-center">
                <p className="text-2xl text-muted-foreground">Waiting for matches to start in this tournament...</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8 overflow-y-auto pr-2">
          <div className="bg-[#1E293B] rounded-3xl p-8 border border-white/5">
            <h2 className="text-3xl font-headline font-bold mb-8 flex items-center gap-4 text-accent">
              <CheckCircle className="h-8 w-8" />
              Recent Results
            </h2>
            <div className="space-y-6">
              {finishedLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
              ) : finishedMatches && finishedMatches.length > 0 ? (
                finishedMatches.map((m) => (
                  <div key={m.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 animate-in fade-in duration-500">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{m.category}</span>
                      <Badge variant="outline" className="text-[10px] h-5 border-emerald-500/30 text-emerald-400">FINAL</Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className={m.teamA.setsWon > m.teamB.setsWon ? "font-bold text-white" : "text-muted-foreground"}>
                          {m.teamA.name}
                        </span>
                        <span className="font-mono font-bold text-accent">{m.teamA.setsWon}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={m.teamB.setsWon > m.teamA.setsWon ? "font-bold text-white" : "text-muted-foreground"}>
                          {m.teamB.name}
                        </span>
                        <span className="font-mono font-bold text-accent">{m.teamB.setsWon}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground italic py-10">No matches finished yet.</p>
              )}
            </div>
          </div>
          <div className="bg-[#1E293B]/50 rounded-3xl p-8 border border-white/5">
            <div className="bg-primary/10 rounded-3xl p-6 text-center">
                <Users className="h-10 w-10 text-primary mx-auto mb-4" />
                <h3 className="text-2xl font-headline font-bold">Tournament Hub</h3>
                <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
                  Scan the QR code at the reception for real-time schedule updates and match-ready notifications.
                </p>
                <div className="mt-6 flex justify-center">
                  <div className="w-32 h-32 bg-white rounded-xl p-2">
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
