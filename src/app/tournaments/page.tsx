
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
import { StatusBadge } from "@/components/ui/status-badge"

export default function PublicTournaments() {
  const db = useFirestore()
  const [search, setSearch] = useState("")

  const tournamentsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "tournaments"), limit(50))
  }, [db])

  const { data: tournaments, loading, error } = useCollection(tournamentsQuery)

  const filtered = tournaments?.filter(t => 
    (t.status === "registration_open" || t.status === "in_progress" || !t.status) && 
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#0F172A] text-white">
      <header className="p-6 border-b border-white/5 flex items-center justify-between sticky top-0 z-50 bg-card/80 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center transition-transform group-hover:rotate-12">
            <Trophy className="text-white h-5 w-5" />
          </div>
          <span className="font-headline font-bold text-xl uppercase tracking-tighter">Tournaments</span>
        </Link>
        <div className="relative w-72 hidden md:block">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search active events..." 
            className="pl-10 bg-white/5 border-white/10 rounded-xl" 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Button asChild variant="outline" className="border-primary/30 text-primary hover:bg-primary/10 rounded-xl px-6 font-bold">
          <Link href="/login">Club Console</Link>
        </Button>
      </header>

      <main className="container max-w-6xl mx-auto py-16 px-6">
        <div className="mb-16 text-center md:text-left space-y-4">
          <h1 className="text-5xl md:text-7xl font-headline font-bold tracking-tighter uppercase leading-none">
            Live <span className="text-primary">Competitions</span>
          </h1>
          <p className="text-xl text-muted-foreground font-medium max-w-2xl">Find and register for the next elite series in your area.</p>
        </div>

        {loading ? (
          <div className="flex justify-center p-32"><Loader2 className="animate-spin h-12 w-12 text-primary" /></div>
        ) : error ? (
          <div className="p-20 text-center text-destructive bg-destructive/5 rounded-[2.5rem] border border-destructive/20 flex flex-col items-center gap-4">
            <AlertCircle className="h-12 w-12" />
            <div>
              <p className="text-xl font-bold uppercase tracking-widest">Network Interrupted</p>
              <p className="text-sm opacity-80 mt-2 max-w-md mx-auto">
                We encountered an error loading the circuit. Please ensure public read access is permitted.
              </p>
            </div>
          </div>
        ) : filtered && filtered.length > 0 ? (
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t, i) => (
              <Card key={t.id} className="bg-card/50 border-white/5 overflow-hidden group hover:border-primary/50 transition-all rounded-[2rem] shadow-2xl">
                <div className="h-56 bg-slate-800 relative overflow-hidden">
                  <Image 
                    src={t.imageUrl || `https://picsum.photos/seed/${t.id}/800/400`} 
                    alt={t.name}
                    fill
                    priority={i < 3}
                    className="object-cover opacity-60 group-hover:scale-110 transition-transform duration-700"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    data-ai-hint="sports tournament"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A] to-transparent"></div>
                  <div className="absolute top-5 left-5">
                    <StatusBadge status={t.status} />
                  </div>
                  <Badge className="absolute top-5 right-5 bg-primary uppercase tracking-[0.2em] font-black text-[10px] px-4 py-1">{t.sport || 'SPORTS'}</Badge>
                  <div className="absolute bottom-5 left-5 flex items-center gap-2">
                    <Badge className="bg-emerald-500 text-white uppercase text-[10px] font-black tracking-widest px-3 py-1 shadow-lg shadow-emerald-500/20">
                      {t.entryFee > 0 ? `$${t.entryFee.toFixed(2)}` : 'FREE ENTRY'}
                    </Badge>
                  </div>
                </div>
                <CardHeader className="pt-6">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-3xl font-headline font-bold leading-tight group-hover:text-primary transition-colors">{t.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 pb-8">
                  <div className="flex items-center gap-3 text-muted-foreground text-sm font-medium">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center"><Calendar className="h-4 w-4" /></div>
                    <span>Starts {t.startDate}</span>
                  </div>
                </CardContent>
                <CardFooter className="pt-0 flex flex-col gap-2">
                  <Button asChild className="w-full h-14 bg-primary hover:bg-primary/90 rounded-2xl font-bold uppercase tracking-[0.2em] shadow-xl shadow-primary/10">
                    <Link href={`/tournaments/${t.id}/register`}>
                      {t.status === 'registration_open' ? 'Register Now' : 'View Arena'}
                    </Link>
                  </Button>
                  <div className="flex gap-2 w-full">
                    <Button asChild variant="outline" size="sm" className="flex-1 rounded-xl text-[10px] uppercase tracking-widest font-bold">
                      <Link href={`/tournaments/${t.id}/leaderboard`}>
                        <Trophy className="h-3 w-3 mr-1" /> Leaders
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="flex-1 rounded-xl text-[10px] uppercase tracking-widest font-bold">
                      <Link href={`/tournaments/${t.id}/bracket`}>
                        Bracket
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="flex-1 rounded-xl text-[10px] uppercase tracking-widest font-bold">
                      <Link href={`/tournaments/${t.id}/results`}>
                        Results
                      </Link>
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-32 bg-white/5 rounded-[3rem] border-dashed border-2 border-white/10 flex flex-col items-center gap-6">
            <Trophy className="h-20 w-20 text-muted-foreground opacity-10" />
            <div className="space-y-2">
               <h3 className="text-3xl font-headline font-bold uppercase tracking-tighter">Quiet on the Courts</h3>
               <p className="text-muted-foreground text-lg max-w-sm mx-auto">No active tournaments found matching your search.</p>
            </div>
            <Button variant="outline" onClick={() => setSearch('')} className="rounded-xl border-primary/30 text-primary">Clear Search</Button>
          </div>
        )}
      </main>
    </div>
  )
}
