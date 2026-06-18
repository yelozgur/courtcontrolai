
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar as CalendarIcon, Clock, MapPin, Loader2, Plus, LayoutGrid, List, Trophy, Database, AlertCircle, Building, Sparkles, Trash2 } from "lucide-react"
import { collection, query, where, limit, addDoc, getDocs, writeBatch, doc, deleteDoc } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection, useUser } from "@/firebase"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
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
  
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<string>("all")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [isAddingMatch, setIsAddingMatch] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  
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
  const clubId = userClubs?.[0]?.id

  // Fetch tournaments for the club
  const tournamentsQuery = useMemoFirebase(() => {
    if (!db || !clubId) return null
    return query(collection(db, "tournaments"), where("clubId", "==", clubId))
  }, [db, clubId])

  const { data: tournaments, loading: toursLoading } = useCollection(tournamentsQuery)
  
  // Auto-select first tournament
  useEffect(() => {
    if (tournaments && tournaments.length > 0 && !selectedTournamentId) {
      setSelectedTournamentId(tournaments[0].id)
    }
  }, [tournaments, selectedTournamentId])

  const activeTournament = tournaments?.find(t => t.id === selectedTournamentId)

  // Auto-set location if only one exists or when switching tournaments
  useEffect(() => {
    if (activeTournament?.locations?.length > 0) {
      if (selectedLocation === "all" || !activeTournament.locations.some((l: any) => l.name === selectedLocation)) {
        setSelectedLocation(activeTournament.locations[0].name)
      }
    } else {
      setSelectedLocation("all")
    }
  }, [activeTournament])

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

  const getDateStr = (val: any) => {
    if (!val) return ""
    try {
      if (val.seconds !== undefined) return format(new Date(val.seconds * 1000), "yyyy-MM-dd")
      if (val instanceof Date) return format(val, "yyyy-MM-dd")
      if (typeof val === 'string') return val.split('T')[0]
    } catch (e) { return "" }
    return ""
  }

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
      const matchDate = getDateStr(m.startTime)
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
        toast({ title: "Match Scheduled", description: "Added to the planner." })
        setIsAddingMatch(false)
        setNewMatch(prev => ({ ...prev, teamA: "", teamB: "" }))
      })
      .catch(async (e) => {
        const error = new FirestorePermissionError({
          path: 'matches',
          operation: 'create',
          requestResourceData: matchData
        })
        errorEmitter.emit('permission-error', error)
      })
  }

  const handleClearAll = async () => {
    if (!db || !selectedTournamentId || !confirm("Delete all matches for this tournament?")) return
    const q = query(collection(db, "matches"), where("tournamentId", "==", selectedTournamentId))
    const snap = await getDocs(q)
    const batch = writeBatch(db)
    snap.docs.forEach(d => batch.delete(d.ref))
    await batch.commit()
    toast({ title: "Schedule Cleared" })
  }

  const handleAutoSchedule = async () => {
    if (!db || !activeTournament || !clubId) return
    setIsOptimizing(true)

    try {
      // 1. Fetch participants
      const participantsQuery = query(
        collection(db, "participants"),
        where("tournamentId", "==", activeTournament.id)
      )
      const pSnap = await getDocs(participantsQuery)
      const participants = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as any))

      if (participants.length < 2) {
        toast({ variant: "destructive", title: "No Participants", description: "At least 2 registered players needed." })
        setIsOptimizing(false)
        return
      }

      // 2. Call AI Optimizer
      const input = {
        tournamentName: activeTournament.name,
        startDate: activeTournament.startDate,
        matchDuration: activeTournament.matchDuration || 60,
        recoveryTime: activeTournament.recoveryTime || 15,
        locations: activeTournament.locations || [{ name: "Main Venue", numCourts: 1 }],
        categories: activeTournament.categories || [],
        participants: participants.map((p: any) => ({
          id: p.id,
          name: p.name,
          categoryId: p.categoryId || "default"
        }))
      }

      const result = await optimizeTournamentSchedule(input)

      // 3. Batch Create Matches
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

      await batch.commit()
      toast({ title: "AI Scheduling Complete", description: `Optimized ${result.scheduledMatches.length} matches.` })
      
      if (result.scheduledMatches.length > 0) {
        const firstMatchDate = new Date(result.scheduledMatches[0].startTime)
        setSelectedDate(firstMatchDate)
      }

    } catch (e: any) {
      console.error(e)
      toast({ variant: "destructive", title: "Optimization Failed", description: "AI could not generate a valid schedule." })
    } finally {
      setIsOptimizing(false)
    }
  }

  const handleSeedData = () => {
    if (!db || !clubId || !selectedTournamentId) return
    setIsSeeding(true)
    const matchesColl = collection(db, "matches")
    const testDate = "2026-06-19"
    const dummyMatches = [
      { court: 1, time: "09:00", teamA: "Ace Kings", teamB: "Padel Pros" },
      { court: 2, time: "10:30", teamA: "Spin Masters", teamB: "Wall Hitters" },
      { court: 1, time: "12:00", teamA: "Court Crushers", teamB: "Net Ninjas" },
      { court: 3, time: "13:30", teamA: "Power Servers", teamB: "Lobbyists" },
    ]

    const promises = dummyMatches.map(m => addDoc(matchesColl, {
      clubId,
      tournamentId: selectedTournamentId,
      status: "scheduled",
      court: m.court,
      startTime: `${testDate}T${m.time}:00`,
      teamA: { name: m.teamA, score: 0, setsWon: 0 },
      teamB: { name: m.teamB, score: 0, setsWon: 0 },
      category: activeTournament?.categories?.[0]?.name || "Open",
      location: selectedLocation !== "all" ? selectedLocation : (activeTournament?.locations?.[0]?.name || "Main Venue")
    }))

    Promise.all(promises).then(() => {
      toast({ title: "Seed Success", description: "Matches created for June 19, 2026." })
      setSelectedDate(new Date("2026-06-19T12:00:00"))
      setIsSeeding(false)
    })
  }

  const handleGridSlotClick = (court: number, time: string) => {
    setNewMatch(prev => ({
      ...prev,
      court: court,
      time: time,
      location: selectedLocation !== "all" ? selectedLocation : (activeTournament?.locations?.[0]?.name || "Main Venue"),
      category: prev.category || activeTournament?.categories?.[0]?.name || "Open"
    }))
    setIsAddingMatch(true)
  }

  if (toursLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary" /></div>

  const timeSlots = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00", "19:30", "21:00"]
  
  const venueCourts = selectedLocation !== "all" 
    ? (activeTournament?.locations?.find((l: any) => l.name === selectedLocation)?.numCourts || activeTournament?.numCourts || 1)
    : (activeTournament?.numCourts || 1)

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-white uppercase tracking-tighter">Match Planner</h1>
          <p className="text-muted-foreground">Manage timings and court allocations per venue.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleAutoSchedule} 
            disabled={isOptimizing || !selectedTournamentId} 
            className="border-primary text-primary hover:bg-primary/10 shadow-[0_0_15px_rgba(139,92,246,0.2)]"
          >
            {isOptimizing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            AI Auto-Schedule
          </Button>

          <Button variant="outline" size="sm" onClick={handleSeedData} disabled={isSeeding || !selectedTournamentId} className="border-accent text-accent">
            {isSeeding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Database className="w-4 h-4 mr-2" />}
            Seed Data
          </Button>

          <Button variant="ghost" size="sm" onClick={handleClearAll} className="text-destructive hover:bg-destructive/10">
            <Trash2 className="w-4 h-4" />
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal bg-card border-white/5", !selectedDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-[180px] bg-card border-white/5">
              <Building className="mr-2 h-4 w-4 opacity-50" />
              <SelectValue placeholder="All Venues" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Venues</SelectItem>
              {activeTournament?.locations?.map((loc: any, i: number) => (
                <SelectItem key={i} value={loc.name}>{loc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select onValueChange={setSelectedTournamentId} value={selectedTournamentId || undefined}>
            <SelectTrigger className="w-[180px] bg-card border-white/5">
              <Trophy className="mr-2 h-4 w-4 opacity-50" />
              <SelectValue placeholder="Tournament" />
            </SelectTrigger>
            <SelectContent>
              {tournaments?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Button onClick={() => setIsAddingMatch(true)} disabled={!selectedTournamentId} className="bg-primary">
            <Plus className="w-4 h-4 mr-2" /> Add Match
          </Button>
        </div>
      </div>

      <Dialog open={isAddingMatch} onOpenChange={setIsAddingMatch}>
        <DialogContent className="bg-card border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Schedule New Match</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-secondary/30 rounded-lg border border-white/5 grid grid-cols-2 gap-2 text-[10px] font-bold uppercase">
              <div className="flex items-center gap-1.5 text-primary">
                <CalendarIcon className="w-3 h-3" /> {selectedDateStr}
              </div>
              <div className="flex items-center gap-1.5 text-accent">
                <Clock className="w-3 h-3" /> {newMatch.time}
              </div>
              <div className="flex items-center gap-1.5 text-emerald-500">
                <Building className="w-3 h-3" /> {newMatch.location || "Default Venue"}
              </div>
              <div className="flex items-center gap-1.5 text-orange-500">
                <MapPin className="w-3 h-3" /> Court {newMatch.court}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Team A</Label>
                <Input value={newMatch.teamA} onChange={e => setNewMatch({...newMatch, teamA: e.target.value})} placeholder="Home" />
              </div>
              <div className="space-y-2">
                <Label>Team B</Label>
                <Input value={newMatch.teamB} onChange={e => setNewMatch({...newMatch, teamB: e.target.value})} placeholder="Away" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Venue Location</Label>
              <Select value={newMatch.location} onValueChange={val => setNewMatch({...newMatch, location: val})}>
                <SelectTrigger className="bg-secondary/30 border-white/5"><SelectValue placeholder="Select Venue" /></SelectTrigger>
                <SelectContent>
                  {activeTournament?.locations?.map((loc: any) => (
                    <SelectItem key={loc.name} value={loc.name}>{loc.name}</SelectItem>
                  ))}
                  {(!activeTournament?.locations || activeTournament.locations.length === 0) && (
                    <SelectItem value="Main Venue">Main Venue</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Court</Label>
                <Input type="number" min="1" value={newMatch.court} onChange={e => setNewMatch({...newMatch, court: parseInt(e.target.value) || 1})} />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Input type="time" value={newMatch.time} onChange={e => setNewMatch({...newMatch, time: e.target.value})} />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={newMatch.category} onValueChange={val => setNewMatch({...newMatch, category: val})}>
                <SelectTrigger className="bg-secondary/30 border-white/5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {activeTournament?.categories?.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                  ))}
                  {(!activeTournament?.categories || activeTournament.categories.length === 0) && (
                    <SelectItem value="Open">Open</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAddingMatch(false)}>Cancel</Button>
            <Button onClick={handleCreateMatch} disabled={!newMatch.teamA || !newMatch.teamB} className="bg-primary">Schedule Match</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6">
        <Tabs value={view} onValueChange={(v: any) => setView(v)}>
          <div className="flex justify-between items-center mb-4">
            <TabsList className="bg-secondary/30 border border-white/5">
              <TabsTrigger value="grid" className="data-[state=active]:bg-primary"><LayoutGrid className="w-4 h-4 mr-2" /> Planner Grid</TabsTrigger>
              <TabsTrigger value="list" className="data-[state=active]:bg-primary"><List className="w-4 h-4 mr-2" /> Timeline View</TabsTrigger>
            </TabsList>
            <div className="text-[10px] font-bold text-accent uppercase tracking-widest bg-accent/10 px-4 py-1.5 rounded-full border border-accent/20 flex items-center gap-2">
              <Building className="w-3 h-3" /> {selectedLocation === "all" ? "ALL VENUES" : selectedLocation} • {venueCourts} COURTS
            </div>
          </div>

          <TabsContent value="grid">
             {!selectedTournamentId ? (
               <Card className="bg-card/50 border-white/5 border-dashed p-20 text-center">
                 <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-10" />
                 <p className="text-muted-foreground italic">Select a tournament to view the planner.</p>
               </Card>
             ) : (
               <Card className="bg-card/50 border-white/5 overflow-x-auto">
                 <CardContent className="p-0">
                   <div 
                    className="grid border-b border-white/5 bg-white/5"
                    style={{ gridTemplateColumns: `100px repeat(${venueCourts}, minmax(200px, 1fr))` }}
                   >
                      <div className="p-4 border-r border-white/5 font-bold text-[10px] uppercase text-muted-foreground flex items-center justify-center text-center">Time Slot</div>
                      {Array.from({ length: venueCourts }).map((_, i) => (
                        <div key={i} className="p-4 border-r border-white/5 text-center font-bold text-[10px] uppercase flex items-center justify-center text-accent">Court {i+1}</div>
                      ))}
                   </div>
                   {timeSlots.map((time, idx) => (
                     <div 
                        key={idx} 
                        className="grid border-b border-white/5 min-h-[140px]"
                        style={{ gridTemplateColumns: `100px repeat(${venueCourts}, minmax(200px, 1fr))` }}
                      >
                       <div className="p-4 border-r border-white/5 bg-white/5 font-mono text-xs flex flex-col items-center justify-center font-bold">
                         <Clock className="w-3 h-3 mb-1 text-primary opacity-50" />
                         {time}
                       </div>
                       {Array.from({ length: venueCourts }).map((_, courtIdx) => {
                         const currentCourt = courtIdx + 1;
                         const match = filteredMatches?.find(m => {
                           const mCourt = Number(m.court);
                           const mTime = getTimeStr(m.startTime);
                           return mCourt === currentCourt && mTime === time;
                         });

                         return (
                           <div key={courtIdx} className="p-2 border-r border-white/5 relative group hover:bg-white/5 transition-all">
                             {match ? (
                               <div className="h-full bg-primary/20 border border-primary/40 rounded-xl p-3 text-[11px] flex flex-col justify-between animate-in fade-in zoom-in-95 overflow-hidden shadow-sm">
                                 <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold truncate text-primary uppercase text-[8px] tracking-wider">{match.category}</span>
                                    <Badge variant="outline" className="text-[7px] h-4 px-1 leading-none bg-background/50 border-primary/30 text-white uppercase">{match.status}</Badge>
                                 </div>
                                 <div className="flex flex-col gap-1.5 font-bold leading-tight flex-1 justify-center">
                                   <div className="flex items-center justify-between gap-1">
                                     <span className="truncate text-white">{match.teamA?.name || "???"}</span>
                                     <span className="text-primary/60">{match.teamA?.score || 0}</span>
                                   </div>
                                   <div className="h-px bg-primary/10 w-full" />
                                   <div className="flex items-center justify-between gap-1">
                                     <span className="truncate text-white">{match.teamB?.name || "???"}</span>
                                     <span className="text-primary/60">{match.teamB?.score || 0}</span>
                                   </div>
                                 </div>
                                 <div className="mt-2 text-[7px] text-muted-foreground flex items-center gap-1 border-t border-primary/10 pt-1">
                                    <Building className="w-2 h-2" /> {typeof match.location === 'object' ? match.location.name : match.location}
                                 </div>
                               </div>
                             ) : (
                               <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                 <Button 
                                   variant="ghost" 
                                   size="icon" 
                                   className="h-12 w-12 rounded-full hover:bg-primary/20 hover:text-primary border border-dashed border-white/10 transition-all" 
                                   onClick={() => handleGridSlotClick(currentCourt, time)}
                                 >
                                   <Plus className="w-6 h-6" />
                                 </Button>
                               </div>
                             )}
                           </div>
                         )
                       })}
                     </div>
                   ))}
                 </CardContent>
               </Card>
             )}
          </TabsContent>

          <TabsContent value="list">
            <div className="space-y-4">
              {matchesLoading ? (
                <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>
              ) : filteredMatches && filteredMatches.length > 0 ? (
                filteredMatches.map(match => (
                  <Card key={match.id} className="bg-card/50 border-white/5 hover:border-primary/30 transition-all overflow-hidden group">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="flex flex-col items-center justify-center bg-secondary/30 p-2 rounded-xl border border-white/5 w-24">
                          <Clock className="w-4 h-4 mb-1 text-primary" />
                          <span className="text-sm font-bold">
                            {getTimeStr(match.startTime) || 'TBD'}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-bold text-lg flex items-center gap-3">
                            {match.teamA?.name || "TBD"} <span className="text-muted-foreground font-normal text-sm italic">vs</span> {match.teamB?.name || "TBD"}
                          </h4>
                          <div className="flex items-center gap-4 mt-2">
                             <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-accent">
                               <MapPin className="w-3.5 h-3.5" /> Court {match.court}
                             </div>
                             <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                               <Trophy className="w-3.5 h-3.5" /> {match.category}
                             </div>
                             <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                               <Building className="w-3.5 h-3.5" /> {typeof match.location === 'object' ? match.location.name : (match.location || 'Main Venue')}
                             </div>
                          </div>
                        </div>
                      </div>
                      <Badge variant={match.status === 'live' ? 'default' : 'outline'} className="uppercase px-4 py-1.5 font-bold text-[10px] tracking-wider">
                        {match.status}
                      </Badge>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-24 bg-white/5 rounded-2xl border-dashed border-2 border-white/10">
                   <p className="text-muted-foreground italic">No matches scheduled for {selectedDateStr} yet.</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
