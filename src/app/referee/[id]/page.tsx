
"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Zap, Loader2, AlertCircle, ArrowLeft, Gavel, Trophy } from "lucide-react"
import { doc, updateDoc, collection, query, where, limit, onSnapshot } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection, useDoc } from "@/firebase"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { useToast } from "@/hooks/use-toast"

export default function RefereeConsole() {
  const { id } = useParams()
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
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
    
    const currentScore = activeMatch[team].score || 0
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

  const awardSet = (team: 'teamA' | 'teamB') => {
    if (!db || !activeMatch || !matchId) return
    
    const currentSets = activeMatch[team].setsWon || 0
    const matchRef = doc(db, "matches", matchId)
    
    const updateData = {
      [`${team}.setsWon`]: currentSets + 1,
      "teamA.score": 0,
      "teamB.score": 0
    }

    updateDoc(matchRef, updateData).catch(async (e) => {
      const error = new FirestorePermissionError({
        path: matchRef.path,
        operation: "update",
        requestResourceData: updateData
      })
      errorEmitter.emit('permission-error', error)
    })

    toast({
      title: "Set Awarded",
      description: `Set awarded to ${activeMatch[team].name}. Games reset.`
    })
  }

  const handleVerify = () => {
    setIsVerifying(true)
    setTimeout(() => setIsVerifying(false), 3000)
    toast({
      title: "Verification Sent",
      description: "Match results sent to players for final approval."
    })
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
        <h2 className="text-xl font-bold">No Live Matches</h2>
        <p className="text-muted-foreground mt-2">No active matches found for {tournament?.name}.</p>
        <Button variant="outline" className="mt-6" onClick={() => router.push("/referee")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Selector
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
        <Badge variant="outline" className="text-accent border-accent font-mono uppercase tracking-widest">Court {activeMatch.court}</Badge>
      </header>

      <main className="flex-1 p-4 flex flex-col gap-6 overflow-y-auto">
        <div className="text-center space-y-1">
          <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Officiating Live</h2>
          <p className="text-lg font-headline font-bold">{activeMatch.category}</p>
        </div>

        {/* Scoring Panels */}
        <div className="grid gap-6">
          {[
            { key: 'teamA' as const, other: 'teamB' as const },
            { key: 'teamB' as const, other: 'teamA' as const }
          ].map(({ key, other }) => (
            <Card key={key} className={`overflow-hidden transition-all duration-300 relative border-2 ${activeMatch[key].setsWon > activeMatch[other].setsWon ? 'border-primary shadow-lg shadow-primary/10' : 'border-border'}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center font-headline font-bold">
                      {activeMatch[key].name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{activeMatch[key].name}</h3>
                      <div className="flex gap-1 mt-1">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className={`h-1.5 w-6 rounded-full ${i < (activeMatch[key].setsWon || 0) ? 'bg-accent' : 'bg-white/10'}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Sets</span>
                    <span className="text-3xl font-headline font-bold text-accent">{activeMatch[key].setsWon || 0}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-secondary/20 p-4 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-4">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-10 w-10 rounded-lg border-2" 
                      onClick={() => updateScore(key, -1)}
                    >
                      -
                    </Button>
                    <div className="w-16 text-center">
                      <span className="text-4xl font-headline font-bold">{activeMatch[key].score || 0}</span>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Games</p>
                    </div>
                    <Button 
                      variant="default" 
                      size="icon" 
                      className="h-10 w-10 rounded-lg bg-primary"
                      onClick={() => updateScore(key, 1)}
                    >
                      +
                    </Button>
                  </div>
                  <Button 
                    variant="ghost" 
                    className="h-14 px-6 border-l border-white/10 text-accent font-bold hover:bg-accent/10"
                    onClick={() => awardSet(key)}
                  >
                    AWARD<br/>SET
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {isVerifying ? (
          <div className="bg-accent/10 border border-accent/20 rounded-2xl p-8 text-center animate-in zoom-in-95">
            <Loader2 className="h-12 w-12 text-accent mx-auto mb-4 animate-spin" />
            <h4 className="font-bold text-accent uppercase tracking-widest">Pending Verification</h4>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Waiting for player confirmation. If tied 1-1, the final decider set will begin once confirmed.
            </p>
          </div>
        ) : (
          <Button 
            className="w-full h-20 text-xl font-bold bg-accent text-accent-foreground hover:bg-accent/90 shadow-xl shadow-accent/20 rounded-2xl"
            onClick={handleVerify}
          >
            SUBMIT MATCH SCORE
          </Button>
        )}
      </main>

      <footer className="p-4 border-t border-border bg-card/50 grid grid-cols-2 gap-3 sticky bottom-0">
        <Button variant="outline" className="text-[10px] uppercase font-bold h-10">Medical Timeout</Button>
        <Button variant="outline" className="text-[10px] uppercase font-bold h-10">Call Supervisor</Button>
      </footer>
    </div>
  )
}
