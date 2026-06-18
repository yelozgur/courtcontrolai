"use client"

import { useState } from "react"
import Link from "next/link"
import { Trophy, Loader2, Search, ArrowRight, Gavel } from "lucide-react"
import { collection, query, where, limit } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection } from "@/firebase"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function RefereeTournamentSelector() {
  const db = useFirestore()
  const [search, setSearch] = useState("")

  const tournamentsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(
      collection(db, "tournaments"), 
      where("status", "==", "active"),
      limit(50)
    )
  }, [db])

  const { data: tournaments, loading } = useCollection(tournamentsQuery)

  const filtered = tournaments?.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))

  return (
    <div className="min-h-screen bg-background flex flex-col items-center p-6">
      <div className="max-w-md w-full space-y-8 py-10">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Gavel className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-headline font-bold tracking-tight uppercase tracking-tighter">Referee Console</h1>
          <p className="text-muted-foreground font-medium">Select a tournament to start officiating.</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder="Search active tournaments..." 
            className="pl-10 h-12 bg-secondary/30 border-white/5"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtered && filtered.length > 0 ? (
            filtered.map((t) => (
              <Link key={t.id} href={`/referee/${t.id}`}>
                <Card className="bg-card hover:border-primary/50 transition-all group overflow-hidden border-white/5">
                  <CardHeader className="p-4 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <Trophy className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold leading-none">{t.name}</CardTitle>
                        <CardDescription className="text-[10px] mt-1 uppercase font-bold tracking-widest text-accent">{t.sport}</CardDescription>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </CardHeader>
                </Card>
              </Link>
            ))
          ) : (
            <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-2xl border-white/5 bg-white/5">
              No active tournaments found.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
