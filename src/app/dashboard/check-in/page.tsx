
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { QrCode, Share2, Download, ExternalLink, Users, Smartphone } from "lucide-react"
import { collection, query, where, limit } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection, useUser } from "@/firebase"

export default function CheckInPage() {
  const db = useFirestore()
  const { user } = useUser()

  const clubsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "clubs"), where("ownerId", "==", user.uid), limit(1))
  }, [db, user])

  const { data: userClubs } = useCollection(clubsQuery)
  const clubId = userClubs?.[0]?.id

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Check-In Hub</h1>
          <p className="text-muted-foreground">Digital entrance for players and staff.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-card/50 border-border overflow-hidden">
          <CardHeader className="bg-primary/10">
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Venue QR Code
            </CardTitle>
            <CardDescription>Display this at your club entrance for players to check-in.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center p-12 space-y-8">
            <div className="p-8 bg-white rounded-3xl shadow-2xl shadow-primary/20">
              {/* Using a placeholder SVG for the QR code */}
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
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-card/50 border-border">
            <CardHeader>
              <CardTitle className="text-lg">Manual Check-In</CardTitle>
              <CardDescription>Quick lookup for players who forgot their phones.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-xl">
                  <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center">
                    <Users className="h-5 w-5 text-accent" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold">Player List Search</p>
                    <p className="text-xs text-muted-foreground">Find and verify registrations manually.</p>
                  </div>
                  <Button size="sm" asChild>
                    <a href="/dashboard/participants">Open Roster</a>
                  </Button>
                </div>

                <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-xl">
                  <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                    <Smartphone className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold">Arena View</p>
                    <p className="text-xs text-muted-foreground">Public dashboard for waiting areas.</p>
                  </div>
                  <Button size="sm" variant="ghost" asChild>
                    <a href="/arena" target="_blank"><ExternalLink className="h-4 w-4" /></a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="bg-accent/10 border border-accent/20 p-6 rounded-2xl">
            <h3 className="font-headline font-bold text-accent mb-2">Automated Notifications</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              When a player checks in, they automatically receive their court assignment and partner details via the Telegram bot.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
