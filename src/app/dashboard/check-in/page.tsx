
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { QrCode, ExternalLink, UserPlus, LogIn, Copy, Check, Trophy, MapPin, Smartphone } from "lucide-react"
import { collection, query, where, limit } from "firebase/firestore"
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

  // Get user's club
  const clubsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "clubs"), where("ownerId", "==", user.uid), limit(1))
  }, [db, user])

  const { data: userClubs } = useCollection(clubsQuery)
  const clubId = userClubs?.[0]?.id

  // Get all tournaments for this club
  // We remove the orderby to avoid composite index requirements for simple listing
  const tournamentsQuery = useMemoFirebase(() => {
    if (!db || !clubId) return null
    return query(
      collection(db, "tournaments"), 
      where("clubId", "==", clubId)
    )
  }, [db, clubId])

  const { data: tournaments, loading: toursLoading } = useCollection(tournamentsQuery)
  const selectedTournament = tournaments?.find(t => t.id === selectedTournamentId)

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const checkInUrl = selectedTournamentId ? `${origin}/tournaments/${selectedTournamentId}/check-in` : '';
  const registerUrl = selectedTournamentId ? `${origin}/tournaments/${selectedTournamentId}/register` : '';

  const copyToClipboard = (url: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast({ title: "Link Copied", description: "The URL has been copied to your clipboard." });
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-white uppercase tracking-tighter">Entry Points</h1>
          <p className="text-muted-foreground">Distribute digital registration and check-in links to players.</p>
        </div>
        <div className="w-full md:w-72">
          {toursLoading ? (
            <div className="h-10 bg-secondary animate-pulse rounded-md" />
          ) : tournaments && tournaments.length > 0 ? (
            <Select onValueChange={setSelectedTournamentId} value={selectedTournamentId || undefined}>
              <SelectTrigger className="bg-card border-white/5">
                <SelectValue placeholder="Select Tournament" />
              </SelectTrigger>
              <SelectContent>
                {tournaments.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="outline" className="border-white/5">No Tournaments Found</Badge>
          )}
        </div>
      </div>

      {!selectedTournamentId ? (
        <Card className="bg-card/50 border-border border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-20 text-center">
            <Trophy className="h-16 w-16 text-muted-foreground mb-4 opacity-10" />
            <h3 className="text-2xl font-bold text-muted-foreground">Select a Tournament Context</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mt-2">
              Choose an event from the selector above to generate unique URLs for player entry.
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
                      Public Registration Link
                    </CardTitle>
                    <CardDescription>Share this link to let players sign up for the tournament.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center p-12 space-y-8">
                    <div className="p-8 bg-white rounded-3xl shadow-2xl shadow-primary/20">
                      <svg width="180" height="180" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                        <path d="M14 14h3M21 14h.01M14 17v.01M17 17v3M21 17v3M14 21h3M21 21h.01" />
                      </svg>
                    </div>
                    <div className="flex gap-4 w-full max-w-sm">
                      <Button className="flex-1" variant="outline" asChild>
                        <a href={registerUrl} target="_blank"><ExternalLink className="mr-2 h-4 w-4" /> View Page</a>
                      </Button>
                      <Button className="flex-1" variant="outline" onClick={() => copyToClipboard(registerUrl)}>
                        {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />} Copy URL
                      </Button>
                    </div>
                    <code className="text-[10px] text-muted-foreground block truncate p-3 bg-secondary/20 rounded-lg border border-border w-full text-center">{registerUrl}</code>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="checkin">
                <Card className="bg-card/50 border-border overflow-hidden">
                  <CardHeader className="bg-accent/10">
                    <CardTitle className="flex items-center gap-2">
                      <QrCode className="h-5 w-5 text-accent" />
                      Venue Check-In Link
                    </CardTitle>
                    <CardDescription>QR or Link for players arriving at the club on match day.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center p-12 space-y-8">
                    <div className="p-8 bg-white rounded-3xl shadow-2xl shadow-accent/20">
                      <svg width="180" height="180" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                        <path d="M14 14h3M21 14h.01M14 17v.01M17 17v3M21 17v3M14 21h3M21 21h.01" />
                        <circle cx="17" cy="17" r="1" fill="black" />
                      </svg>
                    </div>
                    <div className="flex gap-4 w-full max-w-sm">
                      <Button className="flex-1" variant="outline" asChild>
                        <a href={checkInUrl} target="_blank"><ExternalLink className="mr-2 h-4 w-4" /> View Page</a>
                      </Button>
                      <Button className="flex-1" variant="outline" onClick={() => copyToClipboard(checkInUrl)}>
                         {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />} Copy URL
                      </Button>
                    </div>
                    <code className="text-[10px] text-muted-foreground block truncate p-3 bg-secondary/20 rounded-lg border border-border w-full text-center">{checkInUrl}</code>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <Card className="bg-card/50 border-border">
              <CardHeader>
                <CardTitle className="text-lg">Event Summary</CardTitle>
                <CardDescription>Verify context before sharing.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-secondary/30 rounded-xl">
                  <Trophy className="h-5 w-5 text-primary mt-1" />
                  <div>
                    <p className="font-bold text-white">{selectedTournament?.name}</p>
                    <p className="text-xs text-muted-foreground uppercase">{selectedTournament?.sport} • {selectedTournament?.status}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-secondary/30 rounded-xl">
                  <MapPin className="h-5 w-5 text-accent mt-1" />
                  <div>
                    <p className="font-bold text-white">Venues</p>
                    <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                      {selectedTournament?.locations?.length > 0 ? selectedTournament.locations.map((loc: string, i: number) => (
                        <li key={i}>• {loc}</li>
                      )) : <li>• Main Club Location</li>}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="bg-primary/5 border border-primary/20 p-6 rounded-2xl">
              <h3 className="font-headline font-bold text-primary mb-2 flex items-center gap-2">
                <Smartphone className="h-4 w-4" /> Quick Deployment
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Send the <strong>Registration URL</strong> via social media or email. Print the <strong>Check-In QR</strong> and place it at the reception on tournament day.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
