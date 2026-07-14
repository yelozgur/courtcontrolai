"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  Trophy,
  Loader2,
  Crown,
  Medal,
  Award,
  Users,
  ArrowLeft,
  TrendingUp,
  TrendingDown
} from "lucide-react"
import { collection, query, where, getDocs, doc } from "firebase/firestore"
import { useFirestore, useDoc, useMemoFirebase, useFilteredCollection } from "@/firebase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

interface PlayerStanding {
  id: string
  name: string
  email?: string
  packSize?: string
  skillLevel?: string
  rating: number
  matchesPlayed: number
  wins: number
  losses: number
  winRate: number
  rank: number
  trend: 'up' | 'down' | 'same'
}

/**
 * CourtControl AI: Public tournament leaderboard.
 * Tüm oyuncular ELO rating + match kazanma oranına göre sıralanır.
 * Bracket tree'ye bakmadan genel performansı gösterir.
 */
export default function TournamentLeaderboard() {
  const { id } = useParams()
  const db = useFirestore()
  const [standings, setStandings] = useState<PlayerStanding[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'overall' | 'category'>('overall')

  // Tournament meta
  const tournamentRef = useMemoFirebase(() => {
    if (!db || !id) return null
    return doc(db, "tournaments", id as string)
  }, [db, id])
  const { data: tournament } = useDoc(tournamentRef)

  // Get registrations (tournament-specific, subcollection)
  const { data: registrations } = useFilteredCollection<any>(
    `tournaments/${id}/registrations`,
    undefined,
    { limit: 500 }
  )

  // Get ratings (all players)
  const { data: ratings } = useFilteredCollection<any>("ratings", undefined, { limit: 500 })

  // Get matches (tournament-specific via client-side filter)
  const { data: allMatches } = useFilteredCollection<any>("matches", undefined, { limit: 500 })

  // Compute standings
  useEffect(() => {
    if (!registrations || !id) return

    const tournamentRegs = registrations.filter((r: any) =>
      r.tournamentId === id || r.email
    )

    if (tournamentRegs.length === 0) {
      setStandings([])
      setLoading(false)
      return
    }

    // Tournament-specific matches
    const tournamentMatches = (allMatches || []).filter((m: any) => m.tournamentId === id)

    // Build player stats
    const playerStats: Record<string, {
      wins: number
      losses: number
      matchesPlayed: number
    }> = {}

    for (const match of tournamentMatches) {
      if (match.status !== "completed" || !match.winner) continue

      const winnerId = match.winner.id
      const loserId = match.winner.team === 'teamA' ? match.teamB?.id : match.teamA?.id

      if (winnerId) {
        if (!playerStats[winnerId]) playerStats[winnerId] = { wins: 0, losses: 0, matchesPlayed: 0 }
        playerStats[winnerId].wins++
        playerStats[winnerId].matchesPlayed++
      }
      if (loserId) {
        if (!playerStats[loserId]) playerStats[loserId] = { wins: 0, losses: 0, matchesPlayed: 0 }
        playerStats[loserId].losses++
        playerStats[loserId].matchesPlayed++
      }
    }

    // Build standings
    const result: PlayerStanding[] = tournamentRegs.map((reg: any) => {
      const playerId = reg.playerId || reg.id
      const ratingDoc = (ratings || []).find((r: any) => r.id === playerId)
      const stats = playerStats[playerId] || { wins: 0, losses: 0, matchesPlayed: 0 }
      const winRate = stats.matchesPlayed > 0 ? stats.wins / stats.matchesPlayed : 0

      return {
        id: playerId,
        name: reg.name || reg.email?.split("@")[0] || "Anonymous",
        email: reg.email,
        packSize: reg.packSize,
        skillLevel: reg.skillLevel,
        rating: ratingDoc?.elo_score || 1200,
        matchesPlayed: stats.matchesPlayed,
        wins: stats.wins,
        losses: stats.losses,
        winRate,
        rank: 0,
        trend: 'same',
      }
    })

    // Sort: rating > win rate > matches played
    result.sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating
      if (b.winRate !== a.winRate) return b.winRate - a.winRate
      return b.matchesPlayed - a.matchesPlayed
    })

    // Assign rank + trend
    for (let i = 0; i < result.length; i++) {
      result[i].rank = i + 1
      if (i > 0) {
        const prev = result[i - 1]
        if (prev.rating > result[i].rating) result[i].trend = 'down'
        else if (result[i].rating > prev.rating) result[i].trend = 'up'
      }
    }

    setStandings(result)
    setLoading(false)
  }, [registrations, ratings, allMatches, id])

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-5 w-5 text-yellow-400" />
    if (rank === 2) return <Medal className="h-5 w-5 text-slate-300" />
    if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />
    return <span className="text-muted-foreground font-bold">#{rank}</span>
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Loading Standings</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-white">
      {/* Header */}
      <header className="border-b border-white/5 bg-card/40 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href={`/tournaments/${id}`} className="flex items-center gap-2 text-muted-foreground hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Tournament</span>
          </Link>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <span className="font-bold uppercase tracking-tighter">Leaderboard</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-headline font-bold uppercase tracking-tighter">
            {tournament?.name || "Tournament"} Standings
          </h1>
          <p className="text-muted-foreground">
            Live ELO ratings + match performance · Updated in real-time
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={view} onValueChange={(v: any) => setView(v)} className="w-full">
          <TabsList className="bg-secondary/30">
            <TabsTrigger value="overall">All Players</TabsTrigger>
            <TabsTrigger value="category">By Category</TabsTrigger>
          </TabsList>

          <TabsContent value="overall" className="mt-6">
            {!standings || standings.length === 0 ? (
              <Card className="bg-card/50 border-border">
                <CardContent className="p-12 text-center">
                  <Users className="h-16 w-16 mx-auto text-muted-foreground opacity-30 mb-4" />
                  <h3 className="text-2xl font-headline font-bold mb-2">No Players Yet</h3>
                  <p className="text-muted-foreground">Standings will appear once players register.</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-card/50 border-border overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 border-b border-white/5">
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    Top Performers
                  </CardTitle>
                  <CardDescription>{standings.length} player{standings.length !== 1 ? 's' : ''} ranked</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-white/5">
                    {/* Top 3 highlight */}
                    {standings.slice(0, 3).length > 0 && (
                      <div className="bg-gradient-to-r from-primary/5 to-accent/5 p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                        {standings.slice(0, 3).map((p, i) => (
                          <div
                            key={p.id}
                            className={`p-4 rounded-2xl border ${
                              i === 0 ? 'bg-yellow-500/10 border-yellow-500/30' :
                              i === 1 ? 'bg-slate-300/10 border-slate-300/30' :
                              'bg-amber-600/10 border-amber-600/30'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              {getRankIcon(p.rank)}
                              <span className="text-xs font-bold uppercase tracking-widest">
                                {i === 0 ? 'Champion' : i === 1 ? 'Runner-up' : '3rd Place'}
                              </span>
                            </div>
                            <p className="font-bold text-lg truncate">{p.name}</p>
                            <div className="flex items-center gap-2 mt-2 text-sm">
                              <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
                                ELO {p.rating}
                              </Badge>
                              {p.matchesPlayed > 0 && (
                                <span className="text-muted-foreground text-xs">
                                  {p.wins}W-{p.losses}L ({Math.round(p.winRate * 100)}%)
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Full table */}
                    <table className="w-full">
                      <thead className="bg-secondary/20">
                        <tr className="border-b border-white/5">
                          <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Rank</th>
                          <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Player</th>
                          <th className="text-right py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">ELO</th>
                          <th className="text-right py-3 px-4 py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">W-L</th>
                          <th className="text-right py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Win%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.map((p) => (
                          <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                {getRankIcon(p.rank)}
                                {p.trend === 'up' && <TrendingUp className="h-3 w-3 text-emerald-400" />}
                                {p.trend === 'down' && <TrendingDown className="h-3 w-3 text-rose-400" />}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-bold text-white">{p.name}</p>
                              {p.email && <p className="text-xs text-muted-foreground">{p.email}</p>}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-bold">
                                {p.rating}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right text-sm">
                              <span className="text-emerald-400 font-bold">{p.wins}</span>
                              <span className="text-muted-foreground mx-1">-</span>
                              <span className="text-rose-400 font-bold">{p.losses}</span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              {p.matchesPlayed > 0 ? (
                                <span className="text-sm font-bold">{Math.round(p.winRate * 100)}%</span>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">No matches</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="category" className="mt-6">
            <Card className="bg-card/50 border-border">
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">Category filtering coming soon.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
