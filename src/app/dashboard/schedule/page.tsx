
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar as CalendarIcon, Clock, MapPin, Loader2, Plus, LayoutGrid, List, Trophy, Database, AlertCircle } from "lucide-react"
import { collection, query, where, limit, addDoc } from "firebase/firestore"
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
import { format, parseISO, isValid } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

export default function SchedulingPage() {
  const db = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()
  
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [isAddingMatch, setIsAddingMatch] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)
  
  const [newMatch, setNewMatch] = useState({
    teamA: "",
    teamB: "",
    court: 1,
    time: "09:00",
    category: ""
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

  // Fetch matches for the selected tournament
  const matchesQuery = useMemoFirebase(() => {
    if (!db || !selectedTournamentId) return null
    return query(
      collection(db, "matches"), 
      where("tournamentId", "==", selectedTournamentId),
      limit(200)
    )
  }, [db, selectedTournamentId])

  const { data: rawMatches, loading: matchesLoading } = useCollection(matchesQuery)
  
  // Normalized date string for filtering
  const selectedDateStr = format(selectedDate, "yyyy-MM-dd")

  // Robust helper to extract date string (YYYY-MM-DD) from various formats
  const getDateStr = (val: any) => {
    if (!val) return ""
    try {
      // If it's a Firestore Timestamp or object with seconds
      if (val.seconds !== undefined) {
        return format(new Date(val.seconds * 1000), "yyyy-MM-dd")
      }
      // If it's a JS Date
      if (val instanceof Date) {
        return format(val, "yyyy-MM-dd")
      }
      // If it's a string (ISO or simple date)
      if (typeof val === 'string') {
        return val.split('T')[0]
      }
    } catch (e) {
      return ""
    }
    return ""
  }

  // Robust helper to extract time string (HH:mm)
  const getTimeStr = (val: any) => {
    if (!val) return ""
    try {
      if (val.seconds !== undefined) {
        return format(new Date(val.seconds * 1000), "HH:mm")
      }
      if (val instanceof Date) {
        return format(val, "HH:mm")
      }
      if (typeof val === 'string') {
        const parts = val.split('T')
        if (parts.length > 1) return parts[1].substring(0, 5)
        if (val.includes(':')) return val.substring(0, 5)
      }
    } catch (e) {
      return ""
    }
    return ""
  }

  // Filter matches based on selected date
  const filteredMatches = useMemo(() => {
    if (!rawMatches) return []
    return rawMatches.filter(m => {
      const matchDate = getDateStr(m.startTime)
      return matchDate === selectedDateStr
    }).sort((a, b) => getTimeStr(a.startTime).localeCompare(getTimeStr(b.startTime)))
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
      location: activeTournament?.locations?.[0]?.name || "Main Venue"
    }

    const matchesRef = collection(db, "matches")
    addDoc(matchesRef, matchData)
      .then(() => {
        toast({ title: "Match Scheduled", description: "The match has been added to the planner." })
        setIsAddingMatch(false)
        setNewMatch({ teamA: "", teamB: "", court: 1, time: "09:00", category: "" })
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

  const seedDummyMatches = async () => {
    if (!db || !clubId || !selectedTournamentId) return
    setIsSeeding(true)
    
    // Explicitly seed for June 19, 2026
    const testDate = "2026-06-19"
    const dummyMatches = [
      { time: "09:00", court: 1, teamA: "Alpha Strikers", teamB: "Beta Blasters" },
      { time: "10:30", court: 2, teamA: "Gamma Giants", teamB: "Delta Dodgers" },
      { time: "12:00", court: 1, teamA: "Epsilon Elite", teamB: "Zeta Zenith" },
      { time: "13:30", court: Math.min(3, activeTournament?.numCourts || 3), teamA: "Eta Heroes", teamB: "Theta Titans" }
    ]

    const matchesRef = collection(db, "matches")
    
    try {
      for (const m of dummyMatches) {
        const matchData = {
          clubId,
          tournamentId: selectedTournamentId,
          status: "scheduled",
          court: m.court,
          startTime: `${testDate}T${m.time}:00`,
          teamA: { name: m.teamA, score: 0, setsWon: 0 },
          teamB: { name: m.teamB, score: 0, setsWon: 0 },
          category: activeTournament?.categories?.[0]?.name || "Open",
          location: typeof activeTournament?.locations?.[0] === 'object' ? activeTournament.locations[0].name : (activeTournament?.locations?.[0] || "Main Venue")
        }
        await addDoc(matchesRef, matchData)
      }
      
      toast({ 
        title: "Seed Successful", 
        description: "Added 4 matches for June 19, 2026. Switching view..." 
      })
      
      // Force switch to June 19
      setSelectedDate(new Date(2026, 5, 19)) // Month is 0-indexed, so 5 = June
    } catch (e) {
      toast({ variant: "destructive", title: "Seed Failed", description: "Could not create dummy matches." })
    } finally {
      setIsSeeding(false)
    }
  }

  const handleGridSlotClick = (court: number, time: string) => {
    setNewMatch(prev => ({
      ...prev,
      court: court,
      time: time,
      category: prev.category || activeTournament?.categories?.[0]?.name || "Open"
    }))
    setIsAddingMatch(true)
  }

  if (toursLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary" /></div>

  const timeSlots = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00", "19:30", "21:00"]
  const numCourts = Math.max(1, activeTournament?.numCourts || 1)

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-white uppercase tracking-tighter">Match Planner</h1>
          <p className="text-muted-foreground">Orchestrate match timings and court allocations.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="border-accent/30 text-accent hover:bg-accent/10 hidden lg:flex"
            onClick={seedDummyMatches}
            disabled={!selectedTournamentId || isSeeding}
          >
            {isSeeding ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Database className="w-3 h-3 mr-2" />}
            Seed June 19 Data
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal bg-card border-white/5", !selectedDate && "text-muted-foreground")}>
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

          <Select onValueChange={setSelectedTournamentId} value={selectedTournamentId || undefined}>
            <SelectTrigger className="w-[200px] bg-card border-white/5">
              <SelectValue placeholder="Select Tournament" />
            </SelectTrigger>
            <SelectContent>
              {tournaments?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Button onClick={() => setIsAddingMatch(true)} disabled={!selectedTournamentId} className="bg-primary shadow-lg shadow-primary/20">
            <Plus className="w-4 h-4 mr-2" /> Add Match
          </Button>
        </div>
      </div>

      <Dialog open={isAddingMatch} onOpenChange={setIsAddingMatch}>
        <DialogContent className="bg-card border-white/10">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Schedule New Match</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-secondary/30 rounded-lg border border-white/5 flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1 font-bold text-primary">
                <CalendarIcon className="w-3 h-3" /> {selectedDateStr}
              </div>
              <div className="flex items-center gap-1 font-bold text-accent">
                <Clock className="w-3 h-3" /> {newMatch.time}
              </div>
              <div className="flex items-center gap-1 font-bold text-emerald-500">
                <MapPin className="w-3 h-3" /> Court {newMatch.court}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Team A / Player 1</Label>
                <Input value={newMatch.teamA} onChange={e => setNewMatch({...newMatch, teamA: e.target.value})} placeholder="Home Side" className="bg-secondary/30 border-white/5" />
              </div>
              <div className="space-y-2">
                <Label>Team B / Player 2</Label>
                <Input value={newMatch.teamB} onChange={e => setNewMatch({...newMatch, teamB: e.target.value})} placeholder="Away Side" className="bg-secondary/30 border-white/5" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Court Number</Label>
                <Input type="number" min="1" max={numCourts} value={newMatch.court} onChange={e => setNewMatch({...newMatch, court: parseInt(e.target.value) || 1})} className="bg-secondary/30 border-white/5" />
              </div>
              <div className="space-y-2">
                <Label>Time Slot</Label>
                <Input type="time" value={newMatch.time} onChange={e => setNewMatch({...newMatch, time: e.target.value})} className="bg-secondary/30 border-white/5" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={newMatch.category} onValueChange={val => setNewMatch({...newMatch, category: val})}>
                <SelectTrigger className="bg-secondary/30 border-white/5"><SelectValue placeholder="Select Category" /></SelectTrigger>
                <SelectContent>
                  {activeTournament?.categories?.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                  ))}
                  {(!activeTournament?.categories || activeTournament?.categories.length === 0) && (
                    <SelectItem value="Open">Open</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAddingMatch(false)} className="text-white hover:bg-white/5">Cancel</Button>
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
              <Trophy className="w-3 h-3" /> {numCourts} COURTS ACTIVE
            </div>
          </div>

          <TabsContent value="grid">
             {!selectedTournamentId ? (
               <Card className="bg-card/50 border-white/5 border-dashed p-20 text-center">
                 <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-10" />
                 <p className="text-muted-foreground italic">Select a tournament context to view the planner grid.</p>
               </Card>
             ) : (
               <Card className="bg-card/50 border-white/5 overflow-x-auto">
                 <CardContent className="p-0">
                   <div 
                    className="grid border-b border-white/5 bg-white/5"
                    style={{ gridTemplateColumns: `100px repeat(${numCourts}, minmax(200px, 1fr))` }}
                   >
                      <div className="p-4 border-r border-white/5 font-bold text-[10px] uppercase text-muted-foreground flex items-center justify-center">Time Slot</div>
                      {Array.from({ length: numCourts }).map((_, i) => (
                        <div key={i} className="p-4 border-r border-white/5 text-center font-bold text-[10px] uppercase flex items-center justify-center text-accent">Court {i+1}</div>
                      ))}
                   </div>
                   {timeSlots.map((time, idx) => (
                     <div 
                        key={idx} 
                        className="grid border-b border-white/5 min-h-[140px]"
                        style={{ gridTemplateColumns: `100px repeat(${numCourts}, minmax(200px, 1fr))` }}
                      >
                       <div className="p-4 border-r border-white/5 bg-white/5 font-mono text-xs flex flex-col items-center justify-center font-bold">
                         <Clock className="w-3 h-3 mb-1 text-primary opacity-50" />
                         {time}
                       </div>
                       {Array.from({ length: numCourts }).map((_, courtIdx) => {
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
                                    <Badge variant="outline" className="text-[7px] h-4 px-1 leading-none bg-background/50 border-primary/30 text-white">{match.status}</Badge>
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
