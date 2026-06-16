
"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Trophy, Zap, Clock, Users, ArrowLeft, Loader2 } from "lucide-react"
import { collection, query, where, limit, doc } from "firebase/firestore"
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

  const matchesQuery = useMemoFirebase(() => {
    if (!db || !id) return null
    return query(
      collection(db, "matches"), 
      where("tournamentId", "==", id),
      where("status", "==", "live"),
      limit(4)
    )
  }, [db, id])

  const { data: liveMatches, loading } = useCollection(matchesQuery)

  return (
    <div className="min-h-screen bg-[#0F172A] text-white p-8 font-body overflow-hidden flex flex-col">
      {/* Header */}
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

      {/* Main Grid */}
      <div className="grid grid-cols-3 gap-8 flex-1">
        {/* Left Column: Live Scores */}
        <div className="col-span-2 space-y-8">
          <h2 className="text-3xl font-headline font-bold flex items-center gap-4">
            <span className="w-4 h-4 rounded-full bg-accent animate-pulse"></span>
            Live On Courts
          </h2>
          
          <div className="grid gap-6">
            {loading ? (
              <div className="flex items-center justify-center p-20">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            ) : liveMatches && liveMatches.length > 0 ? (
              liveMatches.map((match) => (
                <div key={match.id} className="bg-card/40 border border-white/5 rounded-3xl p-8 flex items-center gap-12 backdrop-blur-md relative overflow-hidden group">
                  <div className="absolute top-0 left-0 h-full w-2 bg-accent"></div>
                  
                  <div className="text-center">
                    <span className="block text-sm text-muted-foreground uppercase font-bold tracking-[0.2em] mb-2">Court</span>
                    <span className="block text-7xl font-headline font-bold">{match.court}</span>
                  </div>

                  <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-2xl font-bold">
                          {match.teamA.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="text-3xl font-bold">{match.teamA.name}</span>
                      </div>
                      <span className="text-6xl font-mono font-bold text-accent">{match.teamA.score}</span>
                    </div>
                    <div className="h-px bg-white/5"></div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-2xl font-bold">
                          {match.teamB.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="text-3xl font-bold">{match.teamB.name}</span>
                      </div>
                      <span className="text-6xl font-mono font-bold opacity-50">{match.teamB.score}</span>
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

        {/* Right Column: Upcoming & Stats */}
        <div className="space-y-12">
          <div className="bg-[#1E293B] rounded-3xl p-8 h-full border border-white/5">
            <h2 className="text-3xl font-headline font-bold mb-8 flex items-center gap-4">
              <Clock className="h-8 w-8 text-primary" />
              Upcoming
            </h2>
            <div className="space-y-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-6 items-center p-4 rounded-2xl hover:bg-white/5 transition-colors opacity-50">
                  <div className="w-20 text-center py-3 bg-white/5 rounded-2xl">
                    <span className="block text-lg font-bold">1{i}:00</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold">TBD Match</h4>
                    <p className="text-muted-foreground text-sm uppercase tracking-wide">Pending Schedule</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 pt-12 border-t border-white/5">
                <div className="bg-primary/10 rounded-3xl p-6 text-center">
                    <Users className="h-10 w-10 text-primary mx-auto mb-4" />
                    <h3 className="text-2xl font-headline font-bold">Tournament Hub</h3>
                    <p className="text-muted-foreground mt-2">Scan the QR code at the reception for real-time schedule updates and match-ready notifications via Telegram.</p>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
