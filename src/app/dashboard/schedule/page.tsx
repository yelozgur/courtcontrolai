
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar as CalendarIcon, Clock, MapPin, Loader2, Plus, LayoutGrid, List, Trophy, Database, AlertCircle, Building, Sparkles, Trash2, Info, DollarSign, BrainCircuit, Users2, History } from "lucide-react"
import { collection, query, where, limit, addDoc, getDocs, writeBatch, doc, updateDoc, increment, deleteDoc } from "firebase/firestore"
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
import { format, differenceInDays } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { optimizeTournamentSchedule } from "@/ai/dev"

export default function SchedulingPage() {
  const db = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()
  
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<string>("all")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [isAddingMatch, setIsAddingMatch] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [showAiPricing, setShowAiPricing] = useState(false)
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

  // Get current user's clubId
  const clubsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "clubs"), where("ownerId", "==", user.uid), limit(1))
  }, [db, user])

  const { data: userClubs } = useCollection(clubsQuery)
  const clubData = userClubs?.[0]
  const clubId = clubData?.id
  const aiUsage = clubData?.aiUsageCount || 0

  // Fetch tournaments for the club
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

  // Fetch participants count for the selected tournament
  useEffect(() => {
    if (!db || !selectedTournamentId) return
    const pQuery = query(collection(db, "participants"), where("tournamentId", "==", selectedTournamentId))
    getDocs(pQuery).then(snap => setParticipantsCount(snap.size))
  }, [db, selectedTournamentId])

  // Fetch matches for the selected tournament
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

  const getTimeStr = (val: any) => {
    if (!val) return ""
    try {
      if (val.seconds !== undefined) return format(new Date(val.seconds * 1000), "HH:mm")
      if (val instanceof Date) return format(val, "HH:mm")
      if (typeof val === 'string') {
        const parts = val.split('T')
        return parts.length > 1 ? parts[1].substring(0, 5) : val.substring(0, 5)
      }
    } catch (e) { return "" }
    return ""
  }

  const filteredMatches = useMemo(() => {
    if (!rawMatches) return []
    return rawMatches.filter(m => {
      const matchDate = m.startTime?.split('T')[0]
      const locName = typeof m.location === 'object' ? m.location.name : m.location
      const locationMatch = selectedLocation === "all" || locName === selectedLocation
      return matchDate === selectedDateStr && locationMatch
    }).sort((a, b) => getTimeStr(a.startTime).localeCompare(getTimeStr(b.startTime)))
  }, [rawMatches, selectedDateStr, selectedLocation])

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
    const matchRef = doc(db, "matches", matchId);
    deleteDoc(matchRef)
      .then(() => toast({ title: "Match Deleted" }))
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: matchRef.path, operation: 'delete' }));
      });
  }

  const handleAutoScheduleTrigger = () => {
    if (!selectedTournamentId) return
    setShowOptimizationSettings(true)
  }

  const proceedToAutoSchedule = () => {
    setShowOptimizationSettings(false)
    if (aiUsage >= 3 && (aiUsage - 3) % 3 === 0) {
      setShowAiPricing(true)
    } else {
      handleAutoSchedule()
    }
  }

  const handleAutoSchedule = async () => {
    if (!db || !activeTournament || !clubId) return
    setIsOptimizing(true)
    setShowAiPricing(false)

    try {
      const pSnap = await getDocs(query(collection(db, "participants"), where("tournamentId", "==", activeTournament.id)))
      const participants = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as any))

      if (participants.length < 2) {
        toast({ variant: "destructive", title: "No Participants", description: "At least 2 registered players needed." })
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
      toast({ title: "AI Optimization Success", description: `Created ${result.scheduledMatches.length} matches.` })
      if (result.scheduledMatches.length > 0) setSelectedDate(new Date(result.scheduledMatches[0].startTime))

    } catch (e: any) {
      toast({ variant: "destructive", title: "Optimization Failed" })
    } finally {
      setIsOptimizing(false)
    }
  }

  const isFreeRun = aiUsage < 3

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-white uppercase tracking-tighter">Match Planner</h1>
          <div className="text-muted-foreground flex items-center gap-2">
            Manage timings and court allocations. 
            <Badge variant="outline" className={cn("text-[10px] border-none font-bold uppercase", isFreeRun ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500")}>
              AI Runs: {aiUsage}/3 Free
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleAutoScheduleTrigger} 
            disabled={isOptimizing || !selectedTournamentId} 
            className="border-primary text-primary hover:bg-primary/10 shadow-[0_0_15px_rgba(139,92,246,0.2)]"
          >
            {isOptimizing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            AI Auto-Schedule
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="bg-card border-white/5">
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

          <Button onClick={() => setIsAddingMatch(true)} disabled={!selectedTournamentId} className="bg-primary"><Plus className="w-4 h-4 mr-2" /> Add Match</Button>
        </div>
      </div>

      <Dialog open={showOptimizationSettings} onOpenChange={setShowOptimizationSettings}>
        <DialogContent className="bg-card border-white/10 max-w-lg">
          <DialogHeader>
            <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mb-4">
              <BrainCircuit className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle className="font-headline text-2xl uppercase">AI Optimization Strategy</DialogTitle>
            <DialogDescription>
              Provide specific instructions to the Tournament Director AI.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
             <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                   <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Participants</p>
                   <p className="text-xl font-bold flex items-center gap-2"><Users2 className="h-4 w-4 text-primary" /> {participantsCount}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                   <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Venues</p>
                   <p className="text-xl font-bold flex items-center gap-2"><Building className="h-4 w-4 text-accent" /> {activeTournament?.locations?.length || 1}</p>
                </div>
             </div>

             <div className="space-y-2">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Strategic Instructions</Label>
                <Textarea 
                  placeholder="e.g. 'Finish Men's Pro by 2pm', 'Allocate court 1 strictly for gold category'..."
                  className="min-h-[120px] bg-background/50 border-white/10"
                  value={aiInstructions}
                  onChange={(e) => setAiInstructions(e.target.value)}
                />
             </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowOptimizationSettings(false)}>Cancel</Button>
            <Button onClick={proceedToAutoSchedule} className="bg-primary">
              Generate Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6">
        <Tabs value={view} onValueChange={(v: any) => setView(v)}>
          <div className="flex justify-between items-center mb-4">
            <TabsList className="bg-secondary/30">
              <TabsTrigger value="grid"><LayoutGrid className="w-4 h-4 mr-2" /> Grid</TabsTrigger>
              <TabsTrigger value="list"><List className="w-4 h-4 mr-2" /> List</TabsTrigger>
            </TabsList>
            <div className="text-[10px] font-bold text-accent uppercase tracking-widest bg-accent/10 px-4 py-1.5 rounded-full border border-accent/20 flex items-center gap-2">
              <Building className="w-3 h-3" /> {selectedLocation === "all" ? "ALL VENUES" : selectedLocation}
            </div>
          </div>

          <TabsContent value="grid">
             {!selectedTournamentId ? (
               <Card className="bg-card/50 border-white/5 border-dashed p-20 text-center">
                 <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-10" />
                 <p className="text-muted-foreground italic">Select a tournament to view the planner.</p>
               </Card>
             ) : (
               <Card className="bg-card/50 border-white/5 overflow-x-auto min-h-[400px] flex items-center justify-center">
                  <div className="text-center space-y-4 opacity-30">
                     <LayoutGrid className="h-16 w-16 mx-auto" />
                     <p className="text-xl font-bold uppercase tracking-tighter">Interactive Grid View</p>
                     <p className="text-sm italic">Displaying {filteredMatches.length} matches for {selectedDateStr}</p>
                  </div>
               </Card>
             )}
          </TabsContent>

          <TabsContent value="list">
             <div className="space-y-4">
                {filteredMatches.length > 0 ? filteredMatches.map(match => (
                  <Card key={match.id} className="bg-card/50 border-white/5 p-4 flex items-center justify-between group hover:border-primary/30 transition-all">
                     <div className="flex items-center gap-6">
                        <div className="w-20 text-center bg-secondary/30 p-2 rounded-xl">
                          <p className="text-xs font-bold text-primary">{getTimeStr(match.startTime)}</p>
                        </div>
                        <div>
                          <h4 className="font-bold">{match.teamA?.name} vs {match.teamB?.name}</h4>
                          <p className="text-[10px] text-muted-foreground uppercase">{match.category} • Court {match.court} • {typeof match.location === 'object' ? match.location.name : match.location}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-3">
                        <Badge variant="outline" className="uppercase text-[10px] border-white/10">{match.status}</Badge>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-all" onClick={() => handleDeleteMatch(match.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                     </div>
                  </Card>
                )) : <div className="p-20 text-center italic text-muted-foreground border-dashed border-2 rounded-xl border-white/5">No matches for this date.</div>}
             </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isAddingMatch} onOpenChange={setIsAddingMatch}>
        <DialogContent className="bg-card border-white/10">
          <DialogHeader><DialogTitle>Manual Match Entry</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label>Home Team/Player</Label>
                 <Input value={newMatch.teamA} onChange={e => setNewMatch({...newMatch, teamA: e.target.value})} />
               </div>
               <div className="space-y-2">
                 <Label>Away Team/Player</Label>
                 <Input value={newMatch.teamB} onChange={e => setNewMatch({...newMatch, teamB: e.target.value})} />
               </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label>Court #</Label>
                 <Input type="number" value={newMatch.court} onChange={e => setNewMatch({...newMatch, court: parseInt(e.target.value) || 1})} />
               </div>
               <div className="space-y-2">
                 <Label>Time (HH:MM)</Label>
                 <Input type="time" value={newMatch.time} onChange={e => setNewMatch({...newMatch, time: e.target.value})} />
               </div>
            </div>
          </div>
          <DialogFooter>
             <Button variant="ghost" onClick={() => setIsAddingMatch(false)}>Cancel</Button>
             <Button onClick={handleCreateMatch} className="bg-primary">Schedule Match</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
