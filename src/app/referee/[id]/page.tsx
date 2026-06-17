
"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Zap, Loader2, AlertCircle, ArrowLeft, Gavel, Trophy, CheckCircle2, Clock, MapPin } from "lucide-react"
import { doc, updateDoc, collection, query, where, limit } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection, useDoc } from "@/firebase"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { useToast } from "@/hooks/use-toast"

export default function RefereeConsole() {
  const { id } = useParams()
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const tournamentRef = useMemoFirebase(() => {
    if (!db || !id) return null
    return doc(db, "tournaments", id as string)
  }, [db, id])
  const { data: tournament } = useDoc(tournamentRef)

  const liveMatchQuery = useMemoFirebase(() => {
    if (!db || !id) return null
    let q = query(collection(db, "matches"), where("tournamentId", "==", id), where("status", "==", "live"))
    if (selectedLocation) q = query(q, where("location", "==", selectedLocation))
    return query(q, limit(1))
  }, [db, id, selectedLocation])

  const { data: matches, loading } = useCollection(liveMatchQuery)
  const activeMatch = matches?.[0]

  const updateScore = (team: 'teamA' | 'teamB', increment: number) => {
    if (!db || !activeMatch) return
    const currentScore = activeMatch[team].score || 0
    const newScore = Math.max(0, currentScore + increment)
    const matchRef = doc(db, "matches", activeMatch.id)
    updateDoc(matchRef, { [`${team}.score`]: newScore });
  }

  const awardSet = (team: 'teamA' | 'teamB') => {
    if (!db || !activeMatch) return
    const currentSets = activeMatch[team].setsWon || 0
    const matchRef = doc(db, "matches", activeMatch.id)
    updateDoc(matchRef, { 
      [`${team}.setsWon`]: currentSets + 1,
      "teamA.score": 0,
      "teamB.score": 0
    });
    toast({ title: "Set Recorded", description: "Games reset for new set." });
  }

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto border-x border-border">
      <header className="p-4 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => router.push("/referee")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1 px-4">
          <Select onValueChange={setSelectedLocation} value={selectedLocation || undefined}>
            <SelectTrigger className="h-8 border-none bg-transparent font-bold">
              <SelectValue placeholder="All Venues" />
            </SelectTrigger>
            <SelectContent>
              {tournament?.locations?.map((loc: string) => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Badge variant="outline" className="text-accent">COURT {activeMatch?.court || '?'}</Badge>
      </header>

      <main className="flex-1 p-4 flex flex-col gap-6 overflow-y-auto">
        {!activeMatch ? (
          <div className="text-center py-20">
            <Gavel className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
            <h2 className="text-xl font-bold">Ready to Officiate</h2>
            <p className="text-muted-foreground text-sm">Select a court or venue above to start scoring live matches.</p>
          </div>
        ) : (
          <>
            <div className="text-center">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{activeMatch.category}</span>
              <h2 className="text-2xl font-headline font-bold">MATCH IN PROGRESS</h2>
            </div>

            <div className="grid gap-6">
              {[
                { key: 'teamA' as const, other: 'teamB' as const },
                { key: 'teamB' as const, other: 'teamA' as const }
              ].map(({ key, other }) => (
                <Card key={key} className={`border-2 transition-all ${activeMatch[key].setsWon > activeMatch[other].setsWon ? 'border-primary' : 'border-border'}`}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-center mb-6">
                      <div className="font-bold text-xl">{activeMatch[key].name}</div>
                      <div className="text-3xl font-headline font-bold text-accent">{activeMatch[key].setsWon || 0} Sets</div>
                    </div>
                    <div className="flex items-center justify-between bg-secondary/20 p-4 rounded-xl">
                      <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" onClick={() => updateScore(key, -1)}>-</Button>
                        <span className="text-5xl font-headline font-bold">{activeMatch[key].score}</span>
                        <Button variant="default" size="icon" onClick={() => updateScore(key, 1)} className="bg-primary">+</Button>
                      </div>
                      <Button variant="ghost" onClick={() => awardSet(key)} className="text-xs font-bold text-accent">AWARD SET</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button className="h-16 text-lg font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl" onClick={() => {
              setIsSubmitting(true);
              updateDoc(doc(db, "matches", activeMatch.id), { status: "completed", completedAt: new Date().toISOString() })
                .then(() => {
                  toast({ title: "Finalized", description: "Match results verified." });
                  setIsSubmitting(false);
                });
            }} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
              FINALIZE RESULTS
            </Button>
          </>
        )}
      </main>

      <footer className="p-4 border-t border-border grid grid-cols-2 gap-4 bg-card/30">
        <Button variant="outline" size="sm" className="text-[10px] font-bold uppercase"><Clock className="w-3 h-3 mr-1" /> Medical TO</Button>
        <Button variant="outline" size="sm" className="text-[10px] font-bold uppercase"><MapPin className="w-3 h-3 mr-1" /> Court Issue</Button>
      </footer>
    </div>
  )
}
