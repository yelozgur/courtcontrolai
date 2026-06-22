"use client"

import { useState } from "react"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { QrCode, ExternalLink, Copy, Check, Trophy, MapPin, Smartphone, Zap } from "lucide-react"
import { collection, query, where, limit } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection, useUser } from "@/firebase"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  
  // Real QR Code API URL
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(checkInUrl)}&bgcolor=FFFFFF&color=0F172A&margin=10`;

  const copyToClipboard = (url: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast({ title: "Link Copied", description: "Venue check-in URL has been copied." });
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-white uppercase tracking-tighter">Venue Arrival</h1>
          <p className="text-muted-foreground">Manage arrival verification for match day.</p>
        </div>
        <div className="w-full md:w-72">
          {toursLoading ? (
            <div className="h-10 bg-secondary animate-pulse rounded-md" />
          ) : (
            <Select onValueChange={setSelectedTournamentId} value={selectedTournamentId || undefined}>
              <SelectTrigger className="bg-card border-white/5">
                <SelectValue placeholder="Select Tournament Context" />
              </SelectTrigger>
              <SelectContent>
                {tournaments?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {!selectedTournamentId ? (
        <Card className="bg-card/50 border-border border-dashed h-[60vh] flex flex-col items-center justify-center">
          <QrCode className="h-20 w-20 text-muted-foreground mb-4 opacity-10" />
          <h3 className="text-2xl font-bold text-muted-foreground uppercase tracking-tighter">Ready for Arrival</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mt-2 text-center text-sm px-10">
            Select an active tournament to generate the venue&apos;s day-of arrival link and functional QR code.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="lg:col-span-7">
            <Card className="bg-card/50 border-accent/20 overflow-hidden shadow-2xl shadow-accent/5">
              <CardHeader className="bg-accent/10 border-b border-accent/10 py-6">
                <CardTitle className="flex items-center gap-2 text-accent uppercase tracking-widest text-sm font-bold">
                  <QrCode className="h-5 w-5" />
                  Day-of Check-In Entry
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center p-12 space-y-8">
                <div className="p-8 bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(34,211,238,0.2)]">
                  <Image 
                    src={qrCodeUrl} 
                    alt="Check-in QR Code" 
                    width={240}
                    height={240}
                    unoptimized
                  />
                </div>
                <div className="flex gap-4 w-full max-w-md">
                  <Button className="flex-1 bg-white/5 border-white/10 hover:bg-white/10" variant="outline" asChild>
                    <a href={checkInUrl} target="_blank"><ExternalLink className="mr-2 h-4 w-4" /> Open Landing Page</a>
                  </Button>
                  <Button className="flex-1" onClick={() => copyToClipboard(checkInUrl)}>
                     {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />} Copy URL Link
                  </Button>
                </div>
                <div className="bg-black/20 p-4 rounded-xl border border-white/5 w-full text-center group transition-all hover:border-accent/30">
                   <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em] mb-2 opacity-50">Public Entry URI</p>
                   <code className="text-xs text-accent font-mono break-all">{checkInUrl}</code>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <Card className="bg-card/30 border-white/5">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold">Event Verification</CardTitle>
                <CardDescription>Confirm venue context before printing.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-secondary/20 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3 mb-1">
                    <Trophy className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-widest text-primary">Tournament</span>
                  </div>
                  <p className="font-bold text-white text-lg">{selectedTournament?.name}</p>
                </div>
                
                <div className="p-4 bg-secondary/20 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3 mb-1">
                    <MapPin className="h-4 w-4 text-accent" />
                    <span className="text-xs font-bold uppercase tracking-widest text-accent">Locations</span>
                  </div>
                  <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                    {selectedTournament?.locations?.length > 0 ? selectedTournament.locations.map((loc: any, i: number) => (
                      <li key={i} className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-accent rounded-full"></div> {typeof loc === 'object' ? loc.name : loc}
                      </li>
                    )) : <li className="italic opacity-50 text-xs">Primary Club Location Only</li>}
                  </ul>
                </div>
              </CardContent>
            </Card>

            <div className="bg-accent/5 border border-accent/20 p-6 rounded-[2rem] relative overflow-hidden group">
              <Zap className="absolute -right-4 -top-4 h-24 w-24 text-accent opacity-5 group-hover:scale-110 transition-transform" />
              <h3 className="font-headline font-bold text-accent mb-2 flex items-center gap-2">
                <Smartphone className="h-4 w-4" /> Digital Check-In Tip
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Print this QR code and place it at the reception. Arriving players can simply scan it to verify their attendance and notify tournament staff they are match-ready.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}