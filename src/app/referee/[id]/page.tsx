"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Zap, Loader2, ArrowLeft, Gavel, CheckCircle2, Clock, MapPin, Building, Send } from "lucide-react"
import { doc, updateDoc, collection, query, where, limit, getDocs, increment } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection, useDoc } from "@/firebase"
import { useI18n } from "@/i18n/I18nProvider"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { useToast } from "@/hooks/use-toast"
import { sendTelegramNotification, formatMatchLiveMessage } from "@/lib/telegram-service"

export default function RefereeConsole() {
  const { id } = useParams()
  const router = useRouter()
  const db = useFirestore()
  const { t } = useI18n()
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

  const { data: rawMatches } = useCollection(liveMatchQuery)

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
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: matchRef.path,
          operation: 'update',
          requestResourceData: { [`${team}.score`]: newScore }
        }))
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

    await sendTelegramNotification({
      botToken: club.telegramBotToken,
      chatId: club.telegramBotUsername || "",
      message: msg
    })

    toast({ title: "Notifications Sent", description: "Players have been alerted via Telegram." })
    setIsNotifying(false)
  }

  const finalizeMatch = async () => {
    if (!db || !activeMatch) return
    setIsSubmitting(true)
    const matchRef = doc(db, "matches", activeMatch.id)
    const teamAScore = activeMatch.teamA?.score || 0
    const teamBScore = activeMatch.teamB?.score || 0
    const winner = teamAScore > teamBScore ? 'teamA' : teamBScore > teamAScore ? 'teamB' : null
    const winnerTeam = winner ? activeMatch[winner] : null

    const updateData: any = {
      status: "completed",
      completedAt: new Date().toISOString(),
      winner: winnerTeam ? {
        team: winner,
        id: winnerTeam.id || null,
        name: winnerTeam.name || 'Unknown',
        finalScore: { teamA: teamAScore, teamB: teamBScore }
      } : null
    }

    try {
      // 1) Match'i completed yap
      await updateDoc(matchRef, updateData)

      // 2) Winner'ı sonraki round'a propagate et
      const nextMatch = activeMatch.winnerNextMatch
      if (nextMatch && winnerTeam) {
        // Sonraki match'i bul: aynı tournamentId, round=nextMatch.round, bracketPosition=nextMatch.bracketPosition
        const nextMatchQuery = query(
          collection(db, "matches"),
          where("tournamentId", "==", activeMatch.tournamentId),
          where("round", "==", nextMatch.round),
          where("bracketPosition", "==", nextMatch.bracketPosition),
          limit(1)
        )
        const nextMatchSnap = await getDocs(nextMatchQuery)
        if (!nextMatchSnap.empty) {
          const nextMatchDoc = nextMatchSnap.docs[0]
          // Hangi takım yuvasına yazacağımıza bracketPosition parity ile karar ver
          // Çift bracketPosition → teamA, tek → teamB (R1'den gelen çift → A, tek → B)
          // Aslında: matchesInRound = bracketSize / 2^r, ve R1'den 2 match bir R2 match'ine gider
          // (1,2)→R2.1, (3,4)→R2.2, ... — yani parentPos = ceil(bracketPosition / 2)
          // Ve slot: parentPos çift ise A, tek ise B (veya tam tersi, conventional bracket)
          // Burada basit yaklaşım: bracketPosition çift ise teamA, tek ise teamB
          const parentPos = Math.ceil(activeMatch.bracketPosition / 2)
          const slot = parentPos % 2 === 1 ? 'teamA' : 'teamB'

          await updateDoc(doc(db, "matches", nextMatchDoc.id), {
            [slot]: {
              id: winnerTeam.id || null,
              name: winnerTeam.name || 'Winner',
              score: 0,
              setsWon: 0
            }
          })
          toast({
            title: "Finalized",
            description: `${winnerTeam.name} advances to Round ${nextMatch.round}.`
          })
        } else {
          toast({ title: "Finalized", description: "Match completed. No next round." })
        }
      } else if (!nextMatch && winnerTeam) {
        // Tournament bitti!
        await updateDoc(doc(db, "tournaments", activeMatch.tournamentId), {
          status: "completed",
          champion: {
            id: winnerTeam.id || null,
            name: winnerTeam.name || 'Unknown',
            finalScore: { teamA: teamAScore, teamB: teamBScore }
          },
          completedAt: new Date().toISOString()
        })
        toast({
          title: "🏆 Tournament Complete!",
          description: `${winnerTeam.name} is the champion!`,
        })
      } else {
        toast({ title: "Finalized", description: "Match completed." })
      }

      // 3) Rating update (ELO-style)
      if (winner && activeMatch.teamA?.id && activeMatch.teamB?.id) {
        const winnerId = activeMatch[winner].id
        const loserId = activeMatch[winner === 'teamA' ? 'teamB' : 'teamA'].id
        // Basit ELO: kazanan +20, kaybeden -10 (gerçek ELO formula sonra)
        const ratingDelta = 20
        try {
          await updateDoc(doc(db, "ratings", winnerId), {
            elo_score: increment(ratingDelta),
            matches_played: increment(1),
            last_updated: new Date().toISOString()
          })
          await updateDoc(doc(db, "ratings", loserId), {
            elo_score: increment(-10),
            matches_played: increment(1),
            last_updated: new Date().toISOString()
          })
        } catch (e) {
          console.warn("Rating update failed:", e)
        }
      }
    } catch (e: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: matchRef.path,
        operation: 'update',
        requestResourceData: updateData
      }))
      toast({
        variant: "destructive",
        title: "Finalize Failed",
        description: e.message || "Unknown error"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (tourneyLoading) return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('referee.syncing')}</p>
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
        <Button variant="outline" size="sm" className="h-12 rounded-xl text-[10px] font-bold uppercase tracking-widest border-white/5"><Clock className="w-4 h-4 mr-2 opacity-50 text-primary" /> {t('referee.medicalTO')}</Button>
        <Button variant="outline" size="sm" className="h-12 rounded-xl text-[10px] font-bold uppercase tracking-widest border-white/5"><MapPin className="w-4 h-4 mr-2 opacity-50 text-accent" /> {t('referee.courtIssue')}</Button>
      </footer>
    </div>
  )
}