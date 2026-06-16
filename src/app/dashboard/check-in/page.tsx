
"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { QrCode, Share2, Download, ExternalLink, Users, Smartphone, Trophy, Loader2 } from "lucide-react"
import { collection, query, where, limit, orderBy } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection, useUser } from "@/firebase"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function CheckInPage() {
  const db = useFirestore()
  const { user } = useUser()
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null)

  const clubsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "clubs"), where("ownerId", "==", user.uid), limit(1))
  }, [db, user])

  const { data: userClubs } = useCollection(clubsQuery)
  const clubId = userClubs?.[0]?.id

  const tournamentsQuery = useMemoFirebase(() => {
    if (!db || !clubId) return null
    return query(
      collection(db, "tournaments"), 
      where("clubId", "==", clubId),
      orderBy("createdAt", "desc")
    )
  }, [db, clubId])

  const { data: tournaments, loading: toursLoading } = useCollection(tournamentsQuery)

  const selectedTournament = tournaments?.find(t => t.id === selectedTournamentId)

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Check-In Hub</h1>
          <p className="text-muted-foreground">Digital entrance for players and staff.</p>
        </div>
        <div className="w-full md:w-72">
          {toursLoading ? (
            <div className="h-10 bg-secondary animate-pulse rounded-md" />
          ) : tournaments && tournaments.length > 0 ? (
            <Select onValueChange={setSelectedTournamentId} value={selectedTournamentId || undefined}>
              <SelectTrigger className="bg-card">
                <SelectValue placeholder="Select Tournament Context" />
              </SelectTrigger>
              <SelectContent>
                {tournaments.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="outline">No Active Tournaments</Badge>
          )}
        </div>
      </div>

      {!selectedTournamentId ? (
        <Card className="bg-card/50 border-border border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-20 text-center">
            <Trophy className="h-16 w-16 text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-2xl font-bold">Choose a Tournament</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mt-2">
              Select a tournament from the dropdown above to generate a specific check-in QR code and dashboard link.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 animate-in fade-in duration-500">
          <Card className="bg-card/50 border-border overflow-hidden">
            <CardHeader className="bg-primary/10">
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" />
                Venue QR Code: {selectedTournament?.name}
              </CardTitle>
              <CardDescription>Display this at your club entrance for players to register and check-in.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center p-12 space-y-8">
              <div className="p-8 bg-white rounded-3xl shadow-2xl shadow-primary/20">
                {/* Visual representation of a QR code */}
                <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <path d="M14 14h3" />
                  <path d="M21 14h.01" />
                  <path d="M14 17v.01" />
                  <path d="M17 17v3" />
                  <path d="M21 17v3" />
                  <path d="M14 21h3" />
                  <path d="M21 21h.01" />
                </svg>
              </div>
              
              <div className="flex gap-4 w-full max-w-sm">
                <Button className="flex-1" variant="outline">
                  <Download className="mr-2 h-4 w-4" /> Download
                </Button>
                <Button className="flex-1" variant="outline">
                  <Share2 className="mr-2 h-4 w-4" /> Print Poster
                </Button>
              </div>
              <p className="text-xs text-muted-foreground italic">Points to: /tournaments/{selectedTournamentId}/register</p>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="bg-card/50 border-border">
              <CardHeader>
                <CardTitle className="text-lg">Tournament Controls</CardTitle>
                <CardDescription>Direct access for this specific event.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-xl hover:bg-secondary/50 transition-colors">
                    <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center">
                      <Trophy className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold">Referee Console</p>
                      <p className="text-xs text-muted-foreground">Officiate live matches for this event.</p>
                    </div>
                    <Button size="sm" asChild>
                      <Link href={`/referee/${selectedTournamentId}`}>Open Console</Link>
                    </Button>
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-xl hover:bg-secondary/50 transition-colors">
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                      <Smartphone className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold">Live Arena</p>
                      <p className="text-xs text-muted-foreground">Public dashboard for spectator screens.</p>
                    </div>
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/arena/${selectedTournamentId}`} target="_blank"><ExternalLink className="h-4 w-4" /></Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="bg-accent/10 border border-accent/20 p-6 rounded-2xl">
              <h3 className="font-headline font-bold text-accent mb-2">Automated Notifications</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Players registered for <span className="text-white font-bold">{selectedTournament?.name}</span> will receive court assignments and status updates automatically via the connected Telegram bot.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
