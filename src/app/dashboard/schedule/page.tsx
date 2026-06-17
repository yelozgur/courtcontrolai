
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar as CalendarIcon, Clock, MapPin, Loader2, Play, Users, LayoutGrid, List } from "lucide-react"
import { collection, query, where, orderBy, limit, addDoc, serverTimestamp } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection, useUser } from "@/firebase"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function SchedulingPage() {
  const db = useFirestore()
  const { user } = useUser()
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null)

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
      orderBy("startTime", "desc"),
      limit(50)
    )
  }, [db, selectedTournamentId])

  const { data: matches, loading: matchesLoading } = useCollection(matchesQuery)

  const createMatch = async () => {
    if (!db || !clubId || !selectedTournamentId) return
    const matchData = {
      clubId,
      tournamentId: selectedTournamentId,
      status: "scheduled",
      court: 1,
      startTime: new Date().toISOString(),
      teamA: { name: "Team 1", score: 0, setsWon: 0 },
      teamB: { name: "Team 2", score: 0, setsWon: 0 },
      category: activeTournament?.categories?.[0]?.name || "Open"
    }
    await addDoc(collection(db, "matches"), matchData)
  }

  if (toursLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary" /></div>

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
          <Button onClick={createMatch} disabled={!selectedTournamentId} className="bg-primary">
            <Play className="w-4 h-4 mr-2" /> Add Match
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        <Tabs value={view} onValueChange={(v: any) => setView(v)}>
          <div className="flex justify-between items-center mb-4">
            <TabsList className="bg-secondary/30">
              <TabsTrigger value="grid"><LayoutGrid className="w-4 h-4 mr-2" /> Planner Grid</TabsTrigger>
              <TabsTrigger value="list"><List className="w-4 h-4 mr-2" /> Timeline View</TabsTrigger>
            </TabsList>
            <div className="text-sm font-bold text-accent">
              {activeTournament?.numCourts || 0} COURTS ALLOCATED
            </div>
          </div>

          <TabsContent value="grid">
             <Card className="bg-card/50 border-border overflow-x-auto">
               <CardContent className="p-0 min-w-[800px]">
                 <div className="grid grid-cols-6 border-b border-border bg-muted/20">
                    <div className="p-4 border-r border-border font-bold">Time Slot</div>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="p-4 border-r border-border text-center font-bold">Court {i+1}</div>
                    ))}
                 </div>
                 {["09:00", "10:30", "12:00", "13:30", "15:00"].map((time, idx) => (
                   <div key={idx} className="grid grid-cols-6 border-b border-border h-24">
                     <div className="p-4 border-r border-border bg-muted/10 font-mono text-xs flex items-center justify-center">{time}</div>
                     {Array.from({ length: 5 }).map((_, courtIdx) => {
                       const match = matches?.find(m => m.court === courtIdx + 1 && m.startTime?.includes(time));
                       return (
                         <div key={courtIdx} className="p-2 border-r border-border relative group hover:bg-white/5 transition-all">
                           {match ? (
                             <div className="h-full bg-primary/20 border border-primary/40 rounded-lg p-2 text-[10px] flex flex-col justify-between animate-in fade-in zoom-in-95">
                               <span className="font-bold truncate">{match.category}</span>
                               <div className="flex flex-col gap-0.5 mt-1 font-medium">
                                 <span className="truncate">{match.teamA.name}</span>
                                 <span className="text-muted-foreground">vs</span>
                                 <span className="truncate">{match.teamB.name}</span>
                               </div>
                             </div>
                           ) : (
                             <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100">
                               <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><Plus className="w-3 h-3" /></Button>
                             </div>
                           )}
                         </div>
                       )
                     })}
                   </div>
                 ))}
               </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="list">
            <div className="space-y-4">
              {matches?.map(match => (
                <Card key={match.id} className="bg-card/50 border-border">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-center justify-center bg-secondary/30 p-2 rounded-xl border w-20">
                        <Clock className="w-4 h-4 mb-1 text-primary" />
                        <span className="text-xs font-bold">{match.startTime ? new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'}</span>
                      </div>
                      <div>
                        <h4 className="font-bold flex items-center gap-2">
                          {match.teamA.name} <span className="text-muted-foreground font-normal">vs</span> {match.teamB.name}
                        </h4>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" /> Court {match.court} • <Trophy className="w-3 h-3" /> {match.category}
                        </p>
                      </div>
                    </div>
                    <Badge variant={match.status === 'live' ? 'default' : 'outline'} className="uppercase">
                      {match.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
