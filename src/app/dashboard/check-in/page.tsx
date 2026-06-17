
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { QrCode, Share2, Download, ExternalLink, Users, Smartphone, Trophy, MapPin, UserPlus, LogIn, Copy, Check } from "lucide-react"
import { collection, query, where, limit, orderBy } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection, useUser } from "@/firebase"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"

export default function CheckInPage() {
  const db = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

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

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const checkInUrl = selectedTournamentId ? `${origin}/tournaments/${selectedTournamentId}/check-in` : '';
  const registerUrl = selectedTournamentId ? `${origin}/tournaments/${selectedTournamentId}/register` : '';

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast({ title: "Link Copied", description: "The URL has been copied to your clipboard." });
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Check-In & Registration</h1>
          <p className="text-muted-foreground">Manage digital entry points for players and staff.</p>
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
              Select a tournament to generate registration and day-of check-in entry points.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12 animate-in fade-in duration-500">
          <div className="lg:col-span-7 space-y-6">
            <Tabs defaultValue="register" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-secondary/30 mb-6">
                <TabsTrigger value="register" className="data-[state=active]:bg-primary">
                  <UserPlus className="w-4 h-4 mr-2" /> Player Registration
                </TabsTrigger>
                <TabsTrigger value="checkin" className="data-[state=active]:bg-accent">
                  <LogIn className="w-4 h-4 mr-2" /> Day-of Check-In
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="register">
                <Card className="bg-card/50 border-border overflow-hidden">
                  <CardHeader className="bg-primary/10">
                    <CardTitle className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5 text-primary" />
                      Registration Entry
                    </CardTitle>
                    <CardDescription>Public link for players to register for the tournament roster.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center p-12 space-y-8">
                    <div className="p-8 bg-white rounded-3xl shadow-2xl shadow-primary/20">
                      <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                        <path d="M14 14h3M21 14h.01M14 17v.01M17 17v3M21 17v3M14 21h3M21 21h.01" />
                      </svg>
                    </div>
                    <div className="flex gap-4 w-full max-w-sm">
                      <Button className="flex-1" variant="outline" asChild>
                        <a href={registerUrl} target="_blank"><ExternalLink className="mr-2 h-4 w-4" /> Open Link</a>
                      </Button>
                      <Button className="flex-1" variant="outline" onClick={() => copyToClipboard(registerUrl)}>
                        {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />} Copy URL
                      </Button>
                    </div>
                    <div className="text-center w-full">
                      <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Public URL</p>
                      <code className="text-[10px] text-muted-foreground block truncate p-3 bg-secondary/20 rounded-lg border border-border">{registerUrl}</code>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="checkin">
                <Card className="bg-card/50 border-border overflow-hidden">
                  <CardHeader className="bg-accent/10">
                    <CardTitle className="flex items-center gap-2">
                      <QrCode className="h-5 w-5 text-accent" />
                      Day-of Check-In
                    </CardTitle>
                    <CardDescription>Scan this at the reception on tournament day to confirm arrival.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center p-12 space-y-8">
                    <div className="p-8 bg-white rounded-3xl shadow-2xl shadow-accent/20">
                      <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                        <path d="M14 14h3M21 14h.01M14 17v.01M17 17v3M21 17v3M14 21h3M21 21h.01" />
                        <circle cx="17" cy="17" r="1" fill="black" />
                      </svg>
                    </div>
                    <div className="flex gap-4 w-full max-w-sm">
                      <Button className="flex-1" variant="outline" asChild>
                        <a href={checkInUrl} target="_blank"><ExternalLink className="mr-2 h-4 w-4" /> Open Link</a>
                      </Button>
                      <Button className="flex-1" variant="outline" onClick={() => copyToClipboard(checkInUrl)}>
                         {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />} Copy URL
                      </Button>
                    </div>
                    <div className="text-center w-full">
                      <p className="text-xs font-bold text-accent uppercase tracking-widest mb-2">Venue URL</p>
                      <code className="text-[10px] text-muted-foreground block truncate p-3 bg-secondary/20 rounded-lg border border-border">{checkInUrl}</code>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <Card className="bg-card/50 border-border">
              <CardHeader>
                <CardTitle className="text-lg">Event Context</CardTitle>
                <CardDescription>Event logistics summary.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-secondary/30 rounded-xl">
                  <Trophy className="h-5 w-5 text-primary mt-1" />
                  <div>
                    <p className="font-bold">{selectedTournament?.name}</p>
                    <p className="text-xs text-muted-foreground uppercase">{selectedTournament?.sport} • {selectedTournament?.status}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-secondary/30 rounded-xl">
                  <MapPin className="h-5 w-5 text-accent mt-1" />
                  <div>
                    <p className="font-bold">Active Venues</p>
                    <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                      {selectedTournament?.locations?.map((loc: string, i: number) => (
                        <li key={i}>• {loc}</li>
                      )) || <li>• Main Club Venue</li>}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="bg-primary/10 border border-primary/20 p-6 rounded-2xl">
              <h3 className="font-headline font-bold text-primary mb-2 flex items-center gap-2">
                <Smartphone className="h-4 w-4" /> Mobile Entry Points
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Players can register via the Public URL. On the day of the event, they use the Venue URL (or QR) to confirm arrival at a specific court or check-in desk.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
