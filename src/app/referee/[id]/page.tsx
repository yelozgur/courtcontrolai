
"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Zap, Loader2, AlertCircle, ArrowLeft, Gavel, Trophy, CheckCircle2, Clock, MapPin, Building } from "lucide-react"
import { doc, updateDoc, collection, query, where, limit } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection, useDoc } from "@/firebase"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { useToast } from "@/hooks/use-toast"

/**
 * Referee Console
 * Handles live scoring for a specific tournament and location.
 */
export default function RefereeConsole() {
  const { id } = useParams()
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch tournament details for location list
  const tournamentRef = useMemoFirebase(() => {
    if (!db || !id) return null
    return doc(db, "tournaments", id as string)
  }, [db, id])
  
  const { data: tournament, loading: tourneyLoading } = useDoc(tournamentRef)

  // Fetch the first live match for the selected location
  const liveMatchQuery = useMemoFirebase(() => {
    if (!db || !id) return null
    // We fetch live matches for this tournament. Filtering by location is handled carefully.
    return query(
      collection(db, "matches"), 
      where("tournamentId", "==", id), 
      where("status", "==", "live"),
      limit(10) // Fetch a few to filter client-side if needed, but we prefer server-side
    )
  }, [db, id])

  const { data: rawMatches, loading: matchesLoading } = useCollection(liveMatchQuery)

  // Client-side filter to ensure location match
  const activeMatch = rawMatches?.find(m => {
    if (!selectedLocation) return false;
    const matchLocName = typeof m.location === 'object' ? m.location.name : m.location;
    return matchLocName === selectedLocation;
  });

  const updateScore = (team: 'teamA' | 'teamB', increment: number) => {
    if (!db || !activeMatch) return
    const currentScore = activeMatch[team].score || 0
    const newScore = Math.max(0, currentScore + increment)
    const matchRef = doc(db, "matches", activeMatch.id)
    
    updateDoc(matchRef, { [`${team}.score`]: newScore })
      .catch(async (e) => {
        const error = new FirestorePermissionError({
          path: matchRef.path,
          operation: 'update',
          requestResourceData: { [`${team}.score`]: newScore }
        })
        errorEmitter.emit('permission-error', error)
      })
  }

  const awardSet = (team: 'teamA' | 'teamB') => {
    if (!db || !activeMatch) return
    const currentSets = activeMatch[team].setsWon || 0
    const matchRef = doc(db, "matches", activeMatch.id)
    
    const updateData = { 
      [`${team}.setsWon`]: currentSets + 1,
      "teamA.score": 0,
      "teamB.score": 0
    }

    updateDoc(matchRef, updateData)
      .then(() => {
        toast({ title: "Set Recorded", description: "Games reset for new set." })
      })
      .catch(async (e) => {
        const error = new FirestorePermissionError({
          path: matchRef.path,
          operation: 'update',
          requestResourceData: updateData
        })
        errorEmitter.emit('permission-error', error)
      })
  }

  const finalizeMatch = () => {
    if (!db || !activeMatch) return
    setIsSubmitting(true)
    const matchRef = doc(db, "matches", activeMatch.id)
    const updateData = { 
      status: "completed", 
      completedAt: new Date().toISOString() 
    }

    updateDoc(matchRef, updateData)
      .then(() => {
        toast({ title: "Finalized", description: "Match results verified and locked." })
        setIsSubmitting(false)
      })
      .catch(async (e) => {
        const error = new FirestorePermissionError({
          path: matchRef.path,
          operation: 'update',
          requestResourceData: updateData
        })
        errorEmitter.emit('permission-error', error)
        setIsSubmitting(false)
      })
  }

  if (tourneyLoading) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Syncing Venue...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto border-x border-border shadow-2xl">
      <header className="p-4 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => router.push("/referee")} className="text-muted-foreground"><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1 px-4">
          <Select onValueChange={setSelectedLocation} value={selectedLocation || undefined}>
            <SelectTrigger className="h-9 border-white/5 bg-secondary/50 font-bold text-xs uppercase">
              <Building className="w-3 h-3 mr-2 text-primary" />
              <SelectValue placeholder="Assign Venue" />
            </SelectTrigger>
            <SelectContent>
              {tournament?.locations?.map((loc: any, i: number) => (
                <SelectItem key={i} value={typeof loc === 'object' ? loc.name : loc}>
                  {typeof loc === 'object' ? loc.name : loc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Badge variant="outline" className="text-accent border-accent/20 px-3">
          COURT {activeMatch?.court || '?'}
        </Badge>
      </header>

      <main className="flex-1 p-6 flex flex-col gap-8 overflow-y-auto">
        {!selectedLocation ? (
          <div className="text-center py-20 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-secondary rounded-3xl flex items-center justify-center mx-auto mb-6">
              <MapPin className="w-10 h-10 text-muted-foreground opacity-40" />
            </div>
            <h2 className="text-2xl font-headline font-bold uppercase tracking-tighter">Location Required</h2>
            <p className="text-muted-foreground text-sm mt-2 max-w-[200px] mx-auto leading-relaxed">
              Please select your assigned venue at the top to start scoring matches.
            </p>
          </div>
        ) : !activeMatch ? (
          <div className="text-center py-20 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Gavel className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-headline font-bold uppercase tracking-tighter">No Live Matches</h2>
            <p className="text-muted-foreground text-sm mt-2 max-w-[200px] mx-auto leading-relaxed">
              Waiting for a match to be set to "Live" at <span className="text-accent font-bold">{selectedLocation}</span>.
            </p>
          </div>
        ) : (
          <>
            <div className="text-center space-y-1">
              <Badge variant="secondary" className="bg-primary/20 text-primary border-none text-[9px] font-bold tracking-[0.2em] px-4 py-1 uppercase">
                {activeMatch.category}
              </Badge>
              <h2 className="text-4xl font-headline font-bold tracking-tighter uppercase">Scoring Mode</h2>
            </div>

            <div className="grid gap-6">
              {[
                { key: 'teamA' as const, other: 'teamB' as const, color: 'text-primary' },
                { key: 'teamB' as const, other: 'teamA' as const, color: 'text-accent' }
              ].map(({ key, other, color }) => (
                <Card key={key} className={`border-2 overflow-hidden transition-all duration-300 ${activeMatch[key].setsWon > activeMatch[other].setsWon ? 'border-primary shadow-lg shadow-primary/10' : 'border-border opacity-90'}`}>
                  <CardContent className="p-6 space-y-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{key === 'teamA' ? 'Home' : 'Away'}</p>
                        <div className="font-bold text-2xl tracking-tight leading-none">{activeMatch[key].name}</div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sets</p>
                        <div className={`text-4xl font-headline font-bold ${color}`}>{activeMatch[key].setsWon || 0}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between bg-secondary/30 p-5 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-6">
                        <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl text-xl font-bold" onClick={() => updateScore(key, -1)}>-</Button>
                        <span className="text-6xl font-headline font-bold tabular-nums min-w-[60px] text-center">{activeMatch[key].score}</span>
                        <Button variant="default" size="icon" className="h-12 w-12 rounded-xl bg-primary shadow-lg shadow-primary/20 text-xl font-bold" onClick={() => updateScore(key, 1)}>+</Button>
                      </div>
                      <Button variant="ghost" onClick={() => awardSet(key)} className="text-[10px] font-bold text-accent uppercase tracking-widest hover:bg-accent/10">Award Set</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button 
              className="h-20 text-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-3xl shadow-xl shadow-emerald-500/20 transition-all active:scale-95" 
              onClick={finalizeMatch} 
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : <CheckCircle2 className="mr-3 h-6 w-6" />}
              FINALIZE RESULTS
            </Button>
          </>
        )}
      </main>

      <footer className="p-4 border-t border-border grid grid-cols-2 gap-4 bg-card/50 backdrop-blur-md">
        <Button variant="outline" size="sm" className="h-12 rounded-xl text-[10px] font-bold uppercase tracking-widest"><Clock className="w-4 h-4 mr-2 opacity-50" /> Medical TO</Button>
        <Button variant="outline" size="sm" className="h-12 rounded-xl text-[10px] font-bold uppercase tracking-widest"><MapPin className="w-4 h-4 mr-2 opacity-50" /> Court Issue</Button>
      </footer>
    </div>
  )
}
