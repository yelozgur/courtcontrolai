
"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Zap, Loader2, AlertCircle, ArrowLeft, Gavel } from "lucide-react"
import { doc, updateDoc, collection, query, where, limit, onSnapshot } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection, useDoc } from "@/firebase"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"

export default function RefereeConsole() {
  const { id } = useParams()
  const router = useRouter()
  const db = useFirestore()
  const [matchId, setMatchId] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  // Find a live match to referee for THIS tournament
  const liveMatchQuery = useMemoFirebase(() => {
    if (!db || !id) return null
    return query(
      collection(db, "matches"), 
      where("tournamentId", "==", id),
      where("status", "==", "live"), 
      limit(1)
    )
  }, [db, id])

  const { data: matches, loading } = useCollection(liveMatchQuery)
  const activeMatch = matches?.[0]

  const tournamentRef = useMemoFirebase(() => {
    if (!db || !id) return null
    return doc(db, "tournaments", id as string)
  }, [db, id])

  const { data: tournament } = useDoc(tournamentRef)

  useEffect(() => {
    if (activeMatch) {
      setMatchId(activeMatch.id)
    }
  }, [activeMatch])

  const updateScore = (team: 'teamA' | 'teamB', increment: number) => {
    if (!db || !activeMatch || !matchId) return
    
    const currentScore = activeMatch[team].score
    const newScore = Math.max(0, currentScore + increment)
    
    const matchRef = doc(db, "matches", matchId)
    updateDoc(matchRef, {
      [`${team}.score`]: newScore
    }).catch(async (e) => {
      const error = new FirestorePermissionError({
        path: matchRef.path,
        operation: "update",
        requestResourceData: { [`${team}.score`]: newScore }
      })
      errorEmitter.emit('permission-error', error)
    })
  }

  const handleVerify = () => {
    setIsVerifying(true)
    setTimeout(() => setIsVerifying(false), 3000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!activeMatch) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold">No Live Matches for {tournament?.name}</h2>
        <p className="text-muted-foreground mt-2">Start a match for this tournament to use the referee console.</p>
        <Button variant="outline" className="mt-6" onClick={() => router.push("/referee")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Change Tournament
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto border-x border-border">
      <header className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.push("/referee")} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="font-headline font-bold text-sm truncate max-w-[150px]">{tournament?.name}</span>
        </div>
        <Badge variant="outline" className="text-accent border-accent">Court {activeMatch.court}</Badge>
      </header>

      <main className="flex-1 p-4 flex flex-col gap-6">
        <div className="text-center space-y-1">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Live Match</h2>
          <p className="text-lg font-headline font-bold">{activeMatch.category}</p>
        </div>

        {/* Team A Card */}
        <Card className={`overflow-hidden transition-all duration-300 ${activeMatch.teamA.score > activeMatch.teamB.score ? 'border-primary ring-1 ring-primary/30' : 'border-border'}`}>
          <CardContent className="p-6 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center font-headline text-2xl font-bold">
              {activeMatch.teamA.name.substring(0, 2).toUpperCase()}
            </div>
            <div className="text-center">
              <h3 className="font-bold text-xl">{activeMatch.teamA.name}</h3>
            </div>
            <div className="flex items-center gap-6">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-12 w-12 rounded-full border-2" 
                onClick={() => updateScore('teamA', -1)}
              >
                -
              </Button>
              <span className="text-6xl font-headline font-bold">{activeMatch.teamA.score}</span>
              <Button 
                variant="default" 
                size="icon" 
                className="h-12 w-12 rounded-full bg-primary"
                onClick={() => updateScore('teamA', 1)}
              >
                +
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground font-bold">VS</span>
          </div>
        </div>

        {/* Team B Card */}
        <Card className={`overflow-hidden transition-all duration-300 ${activeMatch.teamB.score > activeMatch.teamA.score ? 'border-primary ring-1 ring-primary/30' : 'border-border'}`}>
          <CardContent className="p-6 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center font-headline text-2xl font-bold">
              {activeMatch.teamB.name.substring(0, 2).toUpperCase()}
            </div>
            <div className="text-center">
              <h3 className="font-bold text-xl">{activeMatch.teamB.name}</h3>
            </div>
            <div className="flex items-center gap-6">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-12 w-12 rounded-full border-2" 
                onClick={() => updateScore('teamB', -1)}
              >
                -
              </Button>
              <span className="text-6xl font-headline font-bold">{activeMatch.teamB.score}</span>
              <Button 
                variant="default" 
                size="icon" 
                className="h-12 w-12 rounded-full bg-primary"
                onClick={() => updateScore('teamB', 1)}
              >
                +
              </Button>
            </div>
          </CardContent>
        </Card>

        {isVerifying ? (
          <div className="bg-accent/10 border border-accent rounded-xl p-6 text-center animate-in zoom-in-95">
            <Loader2 className="h-12 w-12 text-accent mx-auto mb-2 animate-spin" />
            <h4 className="font-bold text-accent">Waiting for Player Approval</h4>
            <p className="text-xs text-muted-foreground mt-1">Verification request sent via Telegram to both teams.</p>
          </div>
        ) : (
          <Button 
            className="w-full h-16 text-lg font-bold bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={handleVerify}
          >
            Submit Score & Verify
          </Button>
        )}
      </main>

      <footer className="p-4 border-t border-border bg-card/50 grid grid-cols-2 gap-2">
        <Button variant="ghost" className="text-xs">Medical Timeout</Button>
        <Button variant="ghost" className="text-xs">Call Supervisor</Button>
      </footer>
    </div>
  )
}
