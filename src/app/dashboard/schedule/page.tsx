
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar as CalendarIcon, Clock, MapPin, Loader2 } from "lucide-react"
import { collection, query, where, orderBy, limit } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection, useUser } from "@/firebase"

export default function SchedulingPage() {
  const db = useFirestore()
  const { user } = useUser()

  const clubsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "clubs"), where("ownerId", "==", user.uid), limit(1))
  }, [db, user])

  const { data: userClubs } = useCollection(clubsQuery)
  const clubId = userClubs?.[0]?.id

  const matchesQuery = useMemoFirebase(() => {
    if (!db || !clubId) return null
    return query(
      collection(db, "matches"), 
      where("clubId", "==", clubId),
      orderBy("startTime", "desc"),
      limit(20)
    )
  }, [db, clubId])

  const { data: matches, loading } = useCollection(matchesQuery)

  if (!clubId && !loading) return <div className="p-8">No club found. Please register your club first.</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Match Scheduling</h1>
          <p className="text-muted-foreground">Monitor and manage the daily court timeline.</p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="bg-card/50 border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Court Timeline
            </CardTitle>
            <CardDescription>All matches scheduled for the current season.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center p-12">
                <Loader2 className="animate-spin text-primary" />
              </div>
            ) : matches && matches.length > 0 ? (
              <div className="space-y-4">
                {matches.map((match) => (
                  <div key={match.id} className="flex items-center gap-4 p-4 border rounded-xl bg-secondary/10 hover:bg-secondary/20 transition-colors">
                    <div className="flex flex-col items-center justify-center w-20 py-2 bg-background rounded-lg border">
                      <Clock className="h-4 w-4 text-muted-foreground mb-1" />
                      <span className="text-xs font-bold uppercase tracking-tighter">
                        {match.startTime?.toDate ? match.startTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'}
                      </span>
                    </div>
                    
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 items-center gap-4">
                      <div className="col-span-1">
                        <p className="text-xs text-muted-foreground uppercase font-bold">Category</p>
                        <p className="font-medium truncate">{match.category}</p>
                      </div>
                      <div className="col-span-1">
                        <p className="text-xs text-muted-foreground uppercase font-bold">Location</p>
                        <p className="flex items-center gap-1 font-medium">
                          <MapPin className="h-3 w-3" /> Court {match.court}
                        </p>
                      </div>
                      <div className="col-span-2 hidden md:block">
                        <p className="text-xs text-muted-foreground uppercase font-bold">Pairing</p>
                        <p className="font-bold">{match.teamA.name} <span className="text-muted-foreground mx-1">vs</span> {match.teamB.name}</p>
                      </div>
                    </div>

                    <Badge variant={match.status === 'live' ? 'default' : 'secondary'} className="uppercase">
                      {match.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 italic text-muted-foreground border-2 border-dashed rounded-xl">
                No matches have been scheduled yet. Launch a tournament to generate matches.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
