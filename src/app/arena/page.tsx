
"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Trophy, Zap, Loader2, Search, ArrowRight } from "lucide-react"
import { collection, query, limit } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection } from "@/firebase"
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function ArenaTournamentSelector() {
  const db = useFirestore()
  const [search, setSearch] = useState("")

  const tournamentsQuery = useMemoFirebase(() => {
    if (!db) return null
    // Remove strict server-side filtering to avoid composite index issues
    return query(collection(db, "tournaments"), limit(50))
  }, [db])

  const { data: tournaments, loading } = useCollection(tournamentsQuery)

  const filtered = tournaments?.filter(t => 
    (t.status === "active" || !t.status) && // Show active or un-set
    t.name.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)) // Sort client-side

  return (
    <div className="min-h-screen bg-[#0F172A] text-white p-8 font-body flex flex-col items-center">
      <div className="max-w-4xl w-full space-y-12 py-12">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-primary/20">
            <Zap className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-5xl font-headline font-bold tracking-tighter uppercase">Arena Selector</h1>
          <p className="text-xl text-muted-foreground">Select a live tournament to enter the real-time scoring arena.</p>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-4 h-6 w-6 text-muted-foreground" />
          <Input 
            placeholder="Search active tournaments..." 
            className="h-14 pl-14 bg-white/5 border-white/10 text-xl rounded-2xl"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid gap-6">
          {loading ? (
            <div className="flex justify-center p-20">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : filtered && filtered.length > 0 ? (
            filtered.map((t) => (
              <Link key={t.id} href={`/arena/${t.id}`}>
                <Card className="bg-card/40 border-white/5 hover:bg-card/60 hover:border-primary/50 transition-all group overflow-hidden">
                  <CardHeader className="flex flex-row items-center gap-6 p-8">
                    <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center">
                      <Trophy className="h-10 w-10 text-accent" />
                    </div>
                    <div className="flex-1">
                      <Badge className="bg-primary/20 text-primary border-primary/20 mb-2 uppercase tracking-widest">{t.sport}</Badge>
                      <CardTitle className="text-3xl font-headline">{t.name}</CardTitle>
                      <CardDescription className="text-lg">Starts {t.startDate} • Real-time scoring active</CardDescription>
                    </div>
                    <ArrowRight className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                  </CardHeader>
                </Card>
              </Link>
            ))
          ) : (
            <div className="text-center py-20 bg-white/5 rounded-3xl border-dashed border-2 border-white/10">
              <p className="text-xl text-muted-foreground">No active arenas found matching your search.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
