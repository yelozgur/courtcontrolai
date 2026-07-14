"use client"

import { useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  Trophy,
  Loader2,
  Crown,
  CheckCircle2,
  Clock,
  MapPin,
  ArrowLeft,
  Calendar,
  Users,
  Sparkles
} from "lucide-react"
import { doc } from "firebase/firestore"
import { useFirestore, useDoc, useMemoFirebase, useFilteredCollection } from "@/firebase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface MatchRow {
  id: string
  tournamentId?: string
  round: number
  bracketPosition: number
  dayIndex: number
  status: string
  teamA: { name: string; score: number; setsWon?: number }
  teamB: { name: string; score: number; setsWon?: number }
  winner: { team: string; name: string; finalScore?: { teamA: number; teamB: number } } | null
  startTime?: string
  location?: string
  court?: number
  category?: string
}

/**
 * CourtControl AI: Public tournament results page.
 * Tamamlanmış turnuvalar için final sonuçları + bracket tree gösterir.
 * Tournament henüz tamamlanmadıysa "in progress" badge'i gösterir.
 */
export default function TournamentResults() {
  const { id } = useParams()
  const db = useFirestore()

  // Tournament meta
  const tournamentRef = useMemoFirebase(() => {
    if (!db || !id) return null
    return doc(db, "tournaments", id as string)
  }, [db, id])
  const { data: tournament, loading: tourLoading } = useDoc(tournamentRef)

  // Tournament matches (client-side filter)
  const { data: allMatches } = useFilteredCollection<any>("matches", undefined, { limit: 500 })

  // Filter tournament matches + sort by round
  const matches = useMemo(() => {
    if (!allMatches || !id) return null
    return (allMatches as MatchRow[])
      .filter(m => m.tournamentId === id)
      .sort((a, b) => {
        if (a.round !== b.round) return a.round - b.round
        return a.bracketPosition - b.bracketPosition
      })
  }, [allMatches, id])

  // Group by round
  const matchesByRound = useMemo(() => {
    if (!matches) return {}
    const groups: Record<number, MatchRow[]> = {}
    for (const m of matches) {
      if (!groups[m.round]) groups[m.round] = []
      groups[m.round].push(m)
    }
    return groups
  }, [matches])

  const totalRounds = Object.keys(matchesByRound).length
  const completedMatches = matches?.filter(m => m.status === "completed").length || 0
  const champion = tournament?.champion
  const isCompleted = tournament?.status === "completed"

  if (tourLoading) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Loading Results</p>
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
            <span className="font-bold uppercase tracking-tighter">Results</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Title + status */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-headline font-bold uppercase tracking-tighter">
            {tournament?.name || "Tournament"} Results
          </h1>
          <div className="flex items-center justify-center gap-2">
            {isCompleted ? (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 px-3 py-1">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Completed
              </Badge>
            ) : (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 px-3 py-1">
                <Clock className="h-3 w-3 mr-1" /> In Progress
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {completedMatches} / {matches?.length || 0} matches
            </Badge>
          </div>
        </div>

        {/* Champion banner */}
        {champion && (
          <Card className="bg-gradient-to-br from-yellow-500/20 via-primary/10 to-accent/20 border-yellow-500/30 shadow-2xl shadow-yellow-500/20">
            <CardContent className="p-8 text-center space-y-3">
              <Crown className="h-16 w-16 text-yellow-400 mx-auto" />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-yellow-400 mb-1">Tournament Champion</p>
                <h2 className="text-5xl font-headline font-bold">{champion.name}</h2>
              </div>
              {champion.finalScore && (
                <Badge variant="outline" className="bg-background/50 text-base px-4 py-1">
                  Final Score: {champion.finalScore.teamA} - {champion.finalScore.teamB}
                </Badge>
              )}
              {tournament?.completedAt && (
                <p className="text-xs text-muted-foreground">
                  Completed {new Date(tournament.completedAt).toLocaleDateString()}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stats summary */}
        {matches && matches.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="bg-card/50 border-border">
              <CardContent className="p-4 text-center">
                <Users className="h-5 w-5 text-primary mx-auto mb-1" />
                <p className="text-2xl font-headline font-bold">{matches.length}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Matches</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border">
              <CardContent className="p-4 text-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
                <p className="text-2xl font-headline font-bold">{completedMatches}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Completed</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border">
              <CardContent className="p-4 text-center">
                <Sparkles className="h-5 w-5 text-accent mx-auto mb-1" />
                <p className="text-2xl font-headline font-bold">{totalRounds}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Rounds</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border">
              <CardContent className="p-4 text-center">
                <Trophy className="h-5 w-5 text-yellow-400 mx-auto mb-1" />
                <p className="text-2xl font-headline font-bold">
                  {Math.round((completedMatches / Math.max(matches.length, 1)) * 100)}%
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Progress</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Bracket tree by round */}
        {totalRounds > 0 && (
          <div className="space-y-6">
            {Object.keys(matchesByRound).map(roundKey => {
              const round = parseInt(roundKey)
              const roundMatches = matchesByRound[round]
              const roundLabel = round === totalRounds ? 'Final' : round === totalRounds - 1 ? 'Semifinal' : round === totalRounds - 2 ? 'Quarterfinal' : `Round ${round}`

              return (
                <Card key={round} className="bg-card/50 border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        R{round}
                      </Badge>
                      <span className="text-lg">{roundLabel}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {roundMatches.filter(m => m.status === "completed").length} / {roundMatches.length}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {roundMatches.map(m => {
                        const isMatchComplete = m.status === "completed"
                        const winnerIsA = m.winner?.team === "teamA"
                        const winnerIsB = m.winner?.team === "teamB"

                        return (
                          <div
                            key={m.id}
                            className={`p-3 rounded-xl border transition-all ${
                              isMatchComplete
                                ? 'bg-card border-white/10'
                                : 'bg-secondary/20 border-white/5 opacity-60'
                            }`}
                          >
                            <div className="grid grid-cols-12 gap-3 items-center">
                              {/* Position */}
                              <div className="col-span-1 text-center">
                                <span className="text-[10px] font-bold text-muted-foreground">#{m.bracketPosition}</span>
                              </div>

                              {/* Team A */}
                              <div className={`col-span-5 ${winnerIsA ? 'font-bold' : winnerIsB ? 'opacity-50' : ''}`}>
                                <div className="flex items-center gap-2">
                                  {winnerIsA && <Crown className="h-3 w-3 text-yellow-400" />}
                                  <span className="truncate">{m.teamA?.name || "TBD"}</span>
                                </div>
                              </div>

                              {/* Score */}
                              <div className="col-span-1 text-center">
                                <div className="flex flex-col items-center text-xs">
                                  <span className={`font-bold ${winnerIsA ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                                    {m.teamA?.score || 0}
                                  </span>
                                  <span className="text-muted-foreground">-</span>
                                  <span className={`font-bold ${winnerIsB ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                                    {m.teamB?.score || 0}
                                  </span>
                                </div>
                              </div>

                              {/* Team B */}
                              <div className={`col-span-4 ${winnerIsB ? 'font-bold' : winnerIsA ? 'opacity-50' : ''}`}>
                                <div className="flex items-center gap-2">
                                  {winnerIsB && <Crown className="h-3 w-3 text-yellow-400" />}
                                  <span className="truncate">{m.teamB?.name || "TBD"}</span>
                                </div>
                              </div>

                              {/* Status */}
                              <div className="col-span-1 text-right">
                                {isMatchComplete ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-400 inline" />
                                ) : (
                                  <Clock className="h-4 w-4 text-muted-foreground inline" />
                                )}
                              </div>
                            </div>

                            {/* Meta row */}
                            {(m.location || m.startTime) && (
                              <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                                {m.startTime && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(m.startTime).toLocaleString()}
                                  </span>
                                )}
                                {m.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {m.location}
                                  </span>
                                )}
                                {m.category && (
                                  <span className="flex items-center gap-1">
                                    <Trophy className="h-3 w-3" />
                                    {m.category}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Empty state */}
        {(!matches || matches.length === 0) && (
          <Card className="bg-card/50 border-border">
            <CardContent className="p-12 text-center">
              <Trophy className="h-16 w-16 mx-auto text-muted-foreground opacity-30 mb-4" />
              <h3 className="text-2xl font-headline font-bold mb-2">No Matches Yet</h3>
              <p className="text-muted-foreground">The bracket hasn't been generated for this tournament.</p>
              <Button asChild className="mt-6">
                <Link href={`/tournaments/${id}`}>View Tournament</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
