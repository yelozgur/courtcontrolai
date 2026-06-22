"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Zap, Loader2, AlertCircle, ArrowLeft, Gavel, Trophy, CheckCircle2, Clock, MapPin, Building, Send } from "lucide-react"
import { doc, updateDoc, collection, query, where, limit } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection, useDoc } from "@/firebase"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { useToast } from "@/hooks/use-toast"
import { sendTelegramNotification, formatMatchLiveMessage } from "@/lib/telegram-service"

export default function RefereeConsole() {
  const { id } = useParams()
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isNotifying, setIsNotifying] = useState(false)

  const tournamentRef = useMemoFirebase(() => {
    if (!db || !id) return null
    return doc(db, "tournaments", id as string)
  }, [db, id])
  
  const { data: tournament, loading: tourneyLoading } = useDoc(tournamentRef)

  const clubRef = useMemoFirebase(() => {
    if (!db || !tournament?.clubId) return null
    return doc(db, "clubs", tournament.clubId)
  }, [db, tournament?.clubId])
  const { data: club } = useDoc(clubRef)

  const liveMatchQuery = useMemoFirebase(() => {
    if (!db || !id) return null
    return query(
      collection(db, "matches"), 
      where("tournamentId", "==", id), 
      where("status", "==", "live"),
      limit(10)
    )
  }, [db, id])

  const { data: rawMatches, loading: matchesLoading } = useCollection(liveMatchQuery)

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

  const handleNotifyPlayers = async () => {
    if (!activeMatch || !club?.telegramBotToken) {
      toast({ variant: "destructive", title: "Config Missing", description: "Telegram Bot Token not set in Club Settings." })
      return
    }

    setIsNotifying(true)
    const msg = formatMatchLiveMessage(
      tournament?.name || 'Tournament',
      activeMatch.court,
      activeMatch.teamA.name,
      activeMatch.teamB.name,
      activeMatch.category
    )

    // Send to channel or handles if configured
    // This is a placeholder for the logic that maps player handles to chat IDs
    // For now, it notifies the club's general chat if set, or just confirms the action
    await sendTelegramNotification({
      botToken: club.telegramBotToken,
      chatId: club.telegramBotUsername || "", // In production, we'd loop through participant chat IDs
      message: msg
    })

    toast({ title: "Notifications Sent", description: "Players have been alerted via Telegram." })
    setIsNotifying(false)
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
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Syncing Venue...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0F172A] text-white flex flex-col max-w-md mx-auto border-x border-white/5 shadow-2xl">
      <header className="p-4 border-b border-white/5 bg-card/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
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
              Waiting for a match to be set to &quot;Live&quot; at <span className="text-accent font-bold">{selectedLocation}</span>.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Badge variant="secondary" className="bg-primary/20 text-primary border-none text-[9px] font-bold tracking-[0.2em] px-4 py-1 uppercase">
                  {activeMatch.category}
                </Badge>
                <h2 className="text-3xl font-headline font-bold tracking-tighter uppercase">Scoring Mode</h2>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="border-primary text-primary hover:bg-primary/10 h-10 rounded-xl"
                onClick={handleNotifyPlayers}
                disabled={isNotifying}
              >
                {isNotifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Notify
              </Button>
            </div>

            <div className="grid gap-6">
              {[
                { key: 'teamA' as const, other: 'teamB' as const, color: 'text-primary' },
                { key: 'teamB' as const, other: 'teamA' as const, color: 'text-accent' }
              ].map(({ key, other, color }) => (
                <Card key={key} className={`border-2 bg-card/40 overflow-hidden transition-all duration-300 ${activeMatch[key].setsWon > activeMatch[other].setsWon ? 'border-primary shadow-lg shadow-primary/10' : 'border-white/5 opacity-90'}`}>
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
                    
                    <div className="flex items-center justify-between bg-white/5 p-5 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-6">
                        <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl text-xl font-bold bg-background border-white/10" onClick={() => updateScore(key, -1)}>-</Button>
                        <span className="text-6xl font-headline font-bold tabular-nums min-w-[60px] text-center">{activeMatch[key].score}</span>
                        <Button variant="default" size="icon" className="h-12 w-12 rounded-xl bg-primary shadow-lg shadow-primary/20 text-xl font-bold" onClick={() => updateScore(key, 1)}>+</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button 
              className="h-20 text-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-3xl shadow-xl shadow-emerald-500/20 transition-all active:scale-95 uppercase tracking-widest" 
              onClick={finalizeMatch} 
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : <CheckCircle2 className="mr-3 h-6 w-6" />}
              Finalize Results
            </Button>
          </>
        )}
      </main>

      <footer className="p-4 border-t border-white/5 grid grid-cols-2 gap-4 bg-card/50 backdrop-blur-md">
        <Button variant="outline" size="sm" className="h-12 rounded-xl text-[10px] font-bold uppercase tracking-widest border-white/5"><Clock className="w-4 h-4 mr-2 opacity-50 text-primary" /> Medical TO</Button>
        <Button variant="outline" size="sm" className="h-12 rounded-xl text-[10px] font-bold uppercase tracking-widest border-white/5"><MapPin className="w-4 h-4 mr-2 opacity-50 text-accent" /> Court Issue</Button>
      </footer>
    </div>
  )
}