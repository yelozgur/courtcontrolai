
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar as CalendarIcon, Clock, MapPin, Loader2, Play, Users, LayoutGrid, List, Plus, Trophy } from "lucide-react"
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

export default function SchedulingPage() {
  const db = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null)
  const [isAddingMatch, setIsAddingMatch] = useState(false)
  const [newMatch, setNewMatch] = useState({
    teamA: "",
    teamB: "",
    court: 1,
    time: "09:00",
    category: ""
  })

  const clubsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "clubs"), where("ownerId", "==", user.uid), limit(1))
  }, [db, user])

  const { data: userClubs } = useCollection(clubsQuery)
  const clubId = userClubs?.[0]?.id

  const tournamentsQuery = useMemoFirebase(() => {
    if (!db || !clubId) return null
    return query(collection(db, "tournaments"), where("clubId", "==", clubId))
  }, [db, clubId])

  const { data: tournaments, loading: toursLoading } = useCollection(tournamentsQuery)
  const activeTournament = tournaments?.find(t => t.id === selectedTournamentId)

  const matchesQuery = useMemoFirebase(() => {
    if (!db || !selectedTournamentId) return null
    return query(
      collection(db, "matches"), 
      where("tournamentId", "==", selectedTournamentId),
      limit(100)
    )
  }, [db, selectedTournamentId])

  const { data: rawMatches, loading: matchesLoading } = useCollection(matchesQuery)
  
  // Client-side sorting
  const matches = rawMatches?.sort((a, b) => {
    const timeA = String(a.startTime || "")
    const timeB = String(b.startTime || "")
    return timeA.localeCompare(timeB)
  })

  const handleCreateMatch = () => {
    if (!db || !clubId || !selectedTournamentId) return
    
    const matchData = {
      clubId,
      tournamentId: selectedTournamentId,
      status: "scheduled",
      court: Number(newMatch.court),
      startTime: `${new Date().toISOString().split('T')[0]}T${newMatch.time}:00`,
      teamA: { name: newMatch.teamA, score: 0, setsWon: 0 },
      teamB: { name: newMatch.teamB, score: 0, setsWon: 0 },
      category: newMatch.category || activeTournament?.categories?.[0]?.name || "Open"
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

  if (toursLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary" /></div>

  const timeSlots = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00"]
  const numCourts = Math.max(1, activeTournament?.numCourts || 4)

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Match Planner</h1>
          <p className="text-muted-foreground">Orchestrate match timings and court allocations.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select onValueChange={setSelectedTournamentId} value={selectedTournamentId || undefined}>
            <SelectTrigger className="w-[250px] bg-card">
              <SelectValue placeholder="Select Tournament" />
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule New Match</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Team A / Player 1</Label>
                <Input value={newMatch.teamA} onChange={e => setNewMatch({...newMatch, teamA: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Team B / Player 2</Label>
                <Input value={newMatch.teamB} onChange={e => setNewMatch({...newMatch, teamB: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Court Number</Label>
                <Input type="number" min="1" max={numCourts} value={newMatch.court} onChange={e => setNewMatch({...newMatch, court: parseInt(e.target.value) || 1})} />
              </div>
              <div className="space-y-2">
                <Label>Time Slot</Label>
                <Input type="time" value={newMatch.time} onChange={e => setNewMatch({...newMatch, time: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={newMatch.category} onValueChange={val => setNewMatch({...newMatch, category: val})}>
                <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
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
            <Button variant="ghost" onClick={() => setIsAddingMatch(false)}>Cancel</Button>
            <Button onClick={handleCreateMatch} disabled={!newMatch.teamA || !newMatch.teamB}>Schedule Match</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6">
        <Tabs value={view} onValueChange={(v: any) => setView(v)}>
          <div className="flex justify-between items-center mb-4">
            <TabsList className="bg-secondary/30">
              <TabsTrigger value="grid"><LayoutGrid className="w-4 h-4 mr-2" /> Planner Grid</TabsTrigger>
              <TabsTrigger value="list"><List className="w-4 h-4 mr-2" /> Timeline View</TabsTrigger>
            </TabsList>
            <div className="text-sm font-bold text-accent uppercase tracking-widest">
              {numCourts} COURTS ALLOCATED
            </div>
          </div>

          <TabsContent value="grid">
             {!selectedTournamentId ? (
               <Card className="bg-card/50 border-border border-dashed p-20 text-center">
                 <p className="text-muted-foreground italic">Select a tournament above to view the planner grid.</p>
               </Card>
             ) : (
               <Card className="bg-card/50 border-border overflow-x-auto">
                 <CardContent className="p-0">
                   <div 
                    className="grid border-b border-border bg-muted/20"
                    style={{ gridTemplateColumns: `100px repeat(${numCourts}, 1fr)` }}
                   >
                      <div className="p-4 border-r border-border font-bold text-[10px] uppercase text-muted-foreground flex items-center justify-center">Time Slot</div>
                      {Array.from({ length: numCourts }).map((_, i) => (
                        <div key={i} className="p-4 border-r border-border text-center font-bold text-[10px] uppercase flex items-center justify-center">Court {i+1}</div>
                      ))}
                   </div>
                   {timeSlots.map((time, idx) => (
                     <div 
                        key={idx} 
                        className="grid border-b border-border min-h-[100px]"
                        style={{ gridTemplateColumns: `100px repeat(${numCourts}, 1fr)` }}
                      >
                       <div className="p-4 border-r border-border bg-muted/10 font-mono text-xs flex items-center justify-center font-bold">{time}</div>
                       {Array.from({ length: numCourts }).map((_, courtIdx) => {
                         const match = matches?.find(m => 
                           Number(m.court) === courtIdx + 1 && 
                           m.startTime && 
                           (typeof m.startTime === 'string' && m.startTime.includes(time))
                         );
                         return (
                           <div key={courtIdx} className="p-1 border-r border-border relative group hover:bg-white/5 transition-all min-w-[120px]">
                             {match ? (
                               <div className="h-full bg-primary/20 border border-primary/40 rounded-lg p-2 text-[10px] flex flex-col justify-between animate-in fade-in zoom-in-95 overflow-hidden">
                                 <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold truncate text-primary uppercase text-[8px]">{match.category}</span>
                                    <Badge variant="outline" className="text-[6px] h-3 px-1 leading-none">{match.status}</Badge>
                                 </div>
                                 <div className="flex flex-col gap-0.5 font-bold leading-tight">
                                   <span className="truncate text-white">{match.teamA.name}</span>
                                   <span className="text-[8px] text-muted-foreground text-center">vs</span>
                                   <span className="truncate text-white">{match.teamB.name}</span>
                                 </div>
                               </div>
                             ) : (
                               <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100">
                                 <Button 
                                   variant="ghost" 
                                   size="icon" 
                                   className="h-8 w-8 rounded-full hover:bg-primary/20 hover:text-primary" 
                                   onClick={() => {
                                     setNewMatch({...newMatch, court: courtIdx + 1, time});
                                     setIsAddingMatch(true);
                                   }}
                                 >
                                   <Plus className="w-4 h-4" />
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
              ) : matches && matches.length > 0 ? (
                matches.map(match => (
                  <Card key={match.id} className="bg-card/50 border-border hover:border-primary/30 transition-all">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="flex flex-col items-center justify-center bg-secondary/30 p-2 rounded-xl border border-white/5 w-20">
                          <Clock className="w-4 h-4 mb-1 text-primary" />
                          <span className="text-xs font-bold">{match.startTime ? new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'}</span>
                        </div>
                        <div>
                          <h4 className="font-bold flex items-center gap-2">
                            {match.teamA.name} <span className="text-muted-foreground font-normal">vs</span> {match.teamB.name}
                          </h4>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-2 mt-1 uppercase font-bold tracking-widest">
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Court {match.court}</span>
                            <span className="flex items-center gap-1"><Trophy className="w-3 h-3" /> {match.category}</span>
                          </p>
                        </div>
                      </div>
                      <Badge variant={match.status === 'live' ? 'default' : 'outline'} className="uppercase text-[8px] font-bold">
                        {match.status}
                      </Badge>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-20 bg-secondary/10 rounded-xl border-dashed border-2">
                   <p className="text-muted-foreground italic">No matches scheduled for this tournament yet.</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
