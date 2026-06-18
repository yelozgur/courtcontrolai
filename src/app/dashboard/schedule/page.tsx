
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar as CalendarIcon, Clock, MapPin, Loader2, Plus, LayoutGrid, List, Trophy, Building, Sparkles, Trash2, BrainCircuit, Users2, Gavel } from "lucide-react"
import { collection, query, where, limit, addDoc, getDocs, writeBatch, doc, deleteDoc, increment } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection, useUser } from "@/firebase"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { format } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { optimizeTournamentSchedule } from "@/ai/dev"

export default function SchedulingPage() {
  const db = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()
  
  const [view, setView] = useState<'matrix' | 'list'>('matrix')
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [isAddingMatch, setIsAddingMatch] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [showOptimizationSettings, setShowOptimizationSettings] = useState(false)
  const [aiInstructions, setAiInstructions] = useState("")
  const [participantsCount, setParticipantsCount] = useState(0)
  
  const [newMatch, setNewMatch] = useState({
    teamA: "",
    teamB: "",
    court: 1,
    time: "09:00",
    category: "",
    location: ""
  })

  const clubsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "clubs"), where("ownerId", "==", user.uid), limit(1))
  }, [db, user])

  const { data: userClubs } = useCollection(clubsQuery)
  const clubData = userClubs?.[0]
  const clubId = clubData?.id
  const aiUsage = clubData?.aiUsageCount || 0

  const tournamentsQuery = useMemoFirebase(() => {
    if (!db || !clubId) return null
    return query(collection(db, "tournaments"), where("clubId", "==", clubId))
  }, [db, clubId])

  const { data: tournaments, loading: toursLoading } = useCollection(tournamentsQuery)
  
  useEffect(() => {
    if (tournaments && tournaments.length > 0 && !selectedTournamentId) {
      setSelectedTournamentId(tournaments[0].id)
    }
  }, [tournaments, selectedTournamentId])

  const activeTournament = tournaments?.find(t => t.id === selectedTournamentId)

  useEffect(() => {
    if (!db || !selectedTournamentId) return
    const pQuery = query(collection(db, "participants"), where("tournamentId", "==", selectedTournamentId))
    getDocs(pQuery).then(snap => setParticipantsCount(snap.size))
  }, [db, selectedTournamentId])

  const matchesQuery = useMemoFirebase(() => {
    if (!db || !selectedTournamentId) return null
    return query(
      collection(db, "matches"), 
      where("tournamentId", "==", selectedTournamentId),
      limit(500)
    )
  }, [db, selectedTournamentId])

  const { data: rawMatches, loading: matchesLoading } = useCollection(matchesQuery)
  
  const selectedDateStr = format(selectedDate, "yyyy-MM-dd")

  const getTimeKey = (val: any) => {
    if (!val) return ""
    try {
      if (typeof val === 'string') {
        const parts = val.split('T')
        const timePart = parts.length > 1 ? parts[1].substring(0, 5) : val.substring(0, 5)
        // Normalize time to 30-min slots for matrix indexing if needed, 
        // but here we just return the exact string to match the slots array
        return timePart;
      }
    } catch (e) { return "" }
    return ""
  }

  // Matrix Construction Logic: 30-minute intervals from 08:00 to 22:30
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 8; hour <= 22; hour++) {
      const h = hour.toString().padStart(2, '0');
      slots.push(`${h}:00`);
      slots.push(`${h}:30`);
    }
    return slots;
  }, []);

  const courts = useMemo(() => {
    const count = activeTournament?.numCourts || 1;
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [activeTournament?.numCourts]);

  const matrixData = useMemo(() => {
    const grid: Record<string, any> = {}
    if (!rawMatches) return grid

    rawMatches.forEach(m => {
      const mDate = m.startTime?.split('T')[0]
      if (mDate !== selectedDateStr) return
      
      const mTime = getTimeKey(m.startTime)
      const mCourt = m.court
      const key = `${mTime}-${mCourt}`
      grid[key] = m
    })
    return grid
  }, [rawMatches, selectedDateStr])

  const handleCreateMatch = () => {
    if (!db || !clubId || !selectedTournamentId) return
    
    const matchData = {
      clubId,
      tournamentId: selectedTournamentId,
      status: "scheduled",
      court: Number(newMatch.court),
      startTime: `${selectedDateStr}T${newMatch.time}:00`,
      teamA: { name: newMatch.teamA, score: 0, setsWon: 0 },
      teamB: { name: newMatch.teamB, score: 0, setsWon: 0 },
      category: newMatch.category || activeTournament?.categories?.[0]?.name || "Open",
      location: newMatch.location || (activeTournament?.locations?.[0]?.name || "Main Venue")
    }

    addDoc(collection(db, "matches"), matchData)
      .then(() => {
        toast({ title: "Match Scheduled" })
        setIsAddingMatch(false)
        setNewMatch(prev => ({ ...prev, teamA: "", teamB: "" }))
      })
      .catch(async (e) => {
        const error = new FirestorePermissionError({ path: 'matches', operation: 'create', requestResourceData: matchData })
        errorEmitter.emit('permission-error', error)
      })
  }

  const handleDeleteMatch = (matchId: string) => {
    if (!db) return
    const matchRef = doc(db, "matches", matchId)
    deleteDoc(matchRef)
      .then(() => toast({ title: "Match Removed" }))
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: matchRef.path, operation: 'delete' }))
      })
  }

  const handleAutoSchedule = async () => {
    if (!db || !activeTournament || !clubId) return
    setIsOptimizing(true)
    setShowOptimizationSettings(false)

    try {
      const pSnap = await getDocs(query(collection(db, "participants"), where("tournamentId", "==", activeTournament.id)))
      const participants = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as any))

      if (participants.length < 2) {
        toast({ variant: "destructive", title: "Roster Empty", description: "Register players before optimizing." })
        setIsOptimizing(false)
        return
      }

      const input = {
        tournamentName: activeTournament.name,
        startDate: activeTournament.startDate,
        endDate: activeTournament.endDate,
        matchDuration: activeTournament.matchDuration || 60,
        recoveryTime: activeTournament.recoveryTime || 15,
        locations: activeTournament.locations || [{ name: "Main Venue", numCourts: 1 }],
        categories: activeTournament.categories || [],
        participants: participants.map((p: any) => ({ id: p.id, name: p.name, categoryId: p.categoryId || "default" })),
        userInstructions: aiInstructions
      }

      const result = await optimizeTournamentSchedule(input)
      const batch = writeBatch(db)
      const matchesColl = collection(db, "matches")
      
      result.scheduledMatches.forEach(m => {
        const matchRef = doc(matchesColl)
        batch.set(matchRef, {
          clubId,
          tournamentId: activeTournament.id,
          status: "scheduled",
          court: m.court,
          startTime: m.startTime,
          teamA: { name: m.teamA.name, score: 0, setsWon: 0 },
          teamB: { name: m.teamB.name, score: 0, setsWon: 0 },
          category: m.category,
          categoryId: m.categoryId,
          location: m.location
        })
      })

      const clubRef = doc(db, "clubs", clubId)
      batch.update(clubRef, { aiUsageCount: increment(1) })

      await batch.commit()
      toast({ title: "AI Director Success", description: `Optimized ${result.scheduledMatches.length} matches.` })
      if (result.scheduledMatches.length > 0) setSelectedDate(new Date(result.scheduledMatches[0].startTime))

    } catch (e: any) {
      toast({ variant: "destructive", title: "Optimization Error" })
    } finally {
      setIsOptimizing(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-white uppercase tracking-tighter">Match Planner</h1>
          <div className="text-muted-foreground flex items-center gap-2">
            Interactive Venue Matrix: {courts.length} Courts Allocation
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-none">
              AI Runs: {aiUsage}/3 Free
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowOptimizationSettings(true)} 
            disabled={isOptimizing || !selectedTournamentId} 
            className="border-primary text-primary hover:bg-primary/10 shadow-lg shadow-primary/10"
          >
            {isOptimizing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            AI Auto-Schedule
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="bg-card border-white/5 h-10">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-white/10"><Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} /></PopoverContent>
          </Popover>

          <Select onValueChange={setSelectedTournamentId} value={selectedTournamentId || undefined}>
            <SelectTrigger className="w-[180px] bg-card border-white/5"><SelectValue placeholder="Tournament" /></SelectTrigger>
            <SelectContent>{tournaments?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>

          <Button onClick={() => setIsAddingMatch(true)} disabled={!selectedTournamentId} className="bg-primary"><Plus className="w-4 h-4 mr-2" /> Manual Match</Button>
        </div>
      </div>

      <Dialog open={showOptimizationSettings} onOpenChange={setShowOptimizationSettings}>
        <DialogContent className="bg-card border-white/10 max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl uppercase">AI Director Setup</DialogTitle>
            <DialogDescription>Optimize your bracket logic across all courts.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
             <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                   <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Total Players</p>
                   <p className="text-xl font-bold">{participantsCount}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                   <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Venue Scope</p>
                   <p className="text-xl font-bold uppercase text-accent">{courts.length} Courts</p>
                </div>
             </div>
             <div className="space-y-2">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Strategic Goals</Label>
                <Textarea 
                  placeholder="e.g. 'Prioritize court 1 for semifinals', 'Finish all junior matches by 12:00'..."
                  className="min-h-[120px] bg-background/50 border-white/10"
                  value={aiInstructions}
                  onChange={(e) => setAiInstructions(e.target.value)}
                />
             </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowOptimizationSettings(false)}>Cancel</Button>
            <Button onClick={handleAutoSchedule} className="bg-primary">Launch Optimizer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs value={view} onValueChange={(v: any) => setView(v)}>
        <div className="flex justify-between items-center mb-6">
          <TabsList className="bg-secondary/30">
            <TabsTrigger value="matrix"><LayoutGrid className="w-4 h-4 mr-2" /> Matrix</TabsTrigger>
            <TabsTrigger value="list"><List className="w-4 h-4 mr-2" /> List Feed</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="matrix" className="mt-0">
          <div className="overflow-x-auto rounded-[2rem] border border-white/5 bg-card/40 backdrop-blur-xl">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-4 bg-black/20 border-b border-r border-white/5 w-24 sticky left-0 z-20">
                    <Clock className="w-4 h-4 text-muted-foreground mx-auto" />
                  </th>
                  {courts.map(c => (
                    <th key={c} className="p-4 bg-black/20 border-b border-white/5 min-w-[220px]">
                      <div className="flex items-center justify-center gap-2">
                        <Badge variant="outline" className="border-accent text-accent font-bold px-4">Court {c}</Badge>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {timeSlots.map(time => (
                  <tr key={time} className="group">
                    <td className="p-4 text-center font-mono text-sm font-bold text-muted-foreground bg-black/10 border-r border-white/5 sticky left-0 z-20">
                      {time}
                    </td>
                    {courts.map(court => {
                      const match = matrixData[`${time}-${court}`]
                      return (
                        <td key={court} className="p-2 border-r border-white/5 relative h-32 group/cell transition-colors hover:bg-white/[0.02]">
                          {match ? (
                            <div className={cn(
                              "border rounded-xl p-3 h-full flex flex-col justify-between group/card relative transition-all",
                              match.status === 'live' ? "bg-accent/10 border-accent/40 shadow-lg shadow-accent/5" : "bg-primary/10 border-primary/20"
                            )}>
                              <div className="flex justify-between items-start mb-1">
                                <Badge className="text-[8px] bg-primary/20 text-primary border-none uppercase px-1.5">{match.category}</Badge>
                                <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive opacity-0 group-hover/card:opacity-100 transition-opacity" onClick={() => handleDeleteMatch(match.id)}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                              <div className="text-xs font-bold leading-tight flex flex-col gap-1">
                                <span className="truncate">{match.teamA.name}</span>
                                <span className="text-[9px] text-muted-foreground opacity-50 font-normal">vs</span>
                                <span className="truncate">{match.teamB.name}</span>
                              </div>
                              <div className="flex items-center gap-1 mt-1">
                                <div className={cn("w-1.5 h-1.5 rounded-full", match.status === 'live' ? 'bg-accent animate-pulse' : 'bg-muted-foreground/30')} />
                                <span className="text-[8px] uppercase tracking-widest font-bold opacity-60">{match.status}</span>
                              </div>
                            </div>
                          ) : (
                            <Button 
                              variant="ghost" 
                              className="w-full h-full border border-dashed border-white/5 opacity-0 group-hover/cell:opacity-100 transition-all rounded-xl flex flex-col gap-2 text-muted-foreground"
                              onClick={() => {
                                setNewMatch({...newMatch, time, court})
                                setIsAddingMatch(true)
                              }}
                            >
                              <Plus className="w-4 h-4" />
                              <span className="text-[10px] uppercase font-bold tracking-widest">Assign Slot</span>
                            </Button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="list">
          <div className="space-y-4">
            {Object.values(matrixData).length > 0 ? Object.values(matrixData).sort((a,b) => a.startTime.localeCompare(b.startTime)).map(match => (
              <Card key={match.id} className="bg-card/50 border-white/5 p-4 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="bg-secondary/30 p-2 rounded-xl text-center min-w-[80px]">
                    <p className="text-xs font-bold text-primary">{getTimeKey(match.startTime)}</p>
                  </div>
                  <div>
                    <h4 className="font-bold">{match.teamA.name} vs {match.teamB.name}</h4>
                    <p className="text-[10px] text-muted-foreground uppercase">{match.category} • Court {match.court}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="uppercase text-[9px]">{match.status}</Badge>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteMatch(match.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </Card>
            )) : (
              <div className="p-20 text-center italic text-muted-foreground border-dashed border-2 rounded-[2rem] border-white/5">
                No matches scheduled for this date.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isAddingMatch} onOpenChange={setIsAddingMatch}>
        <DialogContent className="bg-card border-white/10">
          <DialogHeader><DialogTitle>Manual Match Allocation</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label>Home Competitor</Label>
                 <Input value={newMatch.teamA} onChange={e => setNewMatch({...newMatch, teamA: e.target.value})} />
               </div>
               <div className="space-y-2">
                 <Label>Away Competitor</Label>
                 <Input value={newMatch.teamB} onChange={e => setNewMatch({...newMatch, teamB: e.target.value})} />
               </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label>Court #</Label>
                 <Input type="number" min="1" max={courts.length} value={newMatch.court} onChange={e => setNewMatch({...newMatch, court: parseInt(e.target.value) || 1})} />
               </div>
               <div className="space-y-2">
                 <Label>Time Slot</Label>
                 <Input type="time" value={newMatch.time} onChange={e => setNewMatch({...newMatch, time: e.target.value})} />
               </div>
            </div>
          </div>
          <DialogFooter>
             <Button variant="ghost" onClick={() => setIsAddingMatch(false)}>Cancel</Button>
             <Button onClick={handleCreateMatch} className="bg-primary">Lock Match</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
