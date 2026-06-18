
"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Trophy, MapPin, Loader2, Search, AlertCircle, DollarSign } from "lucide-react"
import { collection, query, limit } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection } from "@/firebase"
import { useState } from "react"
import { Input } from "@/components/ui/input"

export default function PublicTournaments() {
  const db = useFirestore()
  const [search, setSearch] = useState("")

  const tournamentsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "tournaments"), limit(50))
  }, [db])

  const { data: tournaments, loading, error } = useCollection(tournamentsQuery)

  const filtered = tournaments?.filter(t => 
    (t.status === "active" || t.status === "registration" || !t.status) && 
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#0F172A] text-white">
      <header className="p-6 border-b border-white/5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Trophy className="text-primary h-6 w-6" />
          <span className="font-headline font-bold text-xl uppercase">Tournaments</span>
        </Link>
        <div className="relative w-64 hidden md:block">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search events..." 
            className="pl-10 bg-white/5 border-white/10" 
            value={search}
            onChange={e => setSearch(search)}
          />
        </div>
        <Button asChild variant="outline" className="border-primary text-primary">
          <Link href="/login">Club Login</Link>
        </Button>
      </header>

      <main className="container max-w-6xl mx-auto py-12 px-6">
        <div className="mb-12 text-center md:text-left">
          <h1 className="text-4xl md:text-6xl font-headline font-bold mb-4 tracking-tighter">Live Competitions</h1>
          <p className="text-xl text-muted-foreground">Find and register for the next epic tournament in your area.</p>
        </div>

        {loading ? (
          <div className="flex justify-center p-20"><Loader2 className="animate-spin h-12 w-12 text-primary" /></div>
        ) : error ? (
          <div className="p-20 text-center text-destructive bg-destructive/5 rounded-3xl border border-destructive/20 flex flex-col items-center gap-4">
            <AlertCircle className="h-12 w-12" />
            <div>
              <p className="text-xl font-bold">Access Denied or Connection Error</p>
              <p className="text-sm opacity-80 mt-2 max-w-md mx-auto">
                Could not load tournaments. Please ensure your Firestore Security Rules allow public read access to the tournaments collection.
              </p>
            </div>
          </div>
        ) : filtered && filtered.length > 0 ? (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t, i) => (
              <Card key={t.id} className="bg-card/50 border-white/5 overflow-hidden group hover:border-primary/50 transition-all">
                <div className="h-48 bg-slate-800 relative">
                  <Image 
                    src={t.imageUrl || `https://picsum.photos/seed/${t.id}/800/400`} 
                    alt={t.name}
                    fill
                    priority={i < 3} // Optimize LCP for above-the-fold cards
                    className="object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    data-ai-hint="sports tournament"
                  />
                  <Badge className="absolute top-4 right-4 bg-primary uppercase tracking-widest">{t.sport || 'SPORTS'}</Badge>
                  <Badge className="absolute bottom-4 left-4 bg-emerald-500 text-white uppercase text-[10px] font-bold flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> {t.entryFee > 0 ? `$${t.entryFee.toFixed(2)}` : 'FREE ENTRY'}
                  </Badge>
                </div>
                <CardHeader>
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-2xl font-headline font-bold">{t.name}</CardTitle>
                    <Badge variant="outline" className="text-[10px] border-accent/30 text-accent">
                      {t.status === 'registration' ? 'OPEN' : 'LIVE'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Starts {t.startDate}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span className="truncate">{typeof t.locations?.[0] === 'object' ? t.locations[0].name : (t.locations?.[0] || 'Main Venue')}</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button asChild className="w-full bg-primary hover:bg-primary/90">
                    <Link href={`/tournaments/${t.id}/register`}>
                      {t.status === 'registration' ? 'Register Now' : 'View Tournament'}
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white/5 rounded-3xl border-dashed border-2 border-white/10">
            <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-20" />
            <h3 className="text-2xl font-bold">No active tournaments</h3>
            <p className="text-muted-foreground mt-2">Check back later or register your club to host an event.</p>
          </div>
        )}
      </main>
    </div>
  )
}
