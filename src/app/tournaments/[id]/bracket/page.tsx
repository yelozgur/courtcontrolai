"use client"

import { useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  Trophy,
  Loader2,
  Crown,
  ArrowLeft,
  Calendar
} from "lucide-react"
import { doc } from "firebase/firestore"
import { useFirestore, useDoc, useMemoFirebase, useFilteredCollection } from "@/firebase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useI18n } from "@/i18n/I18nProvider"

interface MatchRow {
  id: string
  tournamentId?: string
  round: number
  bracketPosition: number
  dayIndex: number
  status: string
  teamA: { id?: string; name: string }
  teamB: { id?: string; name: string }
  winner: { team: string; name: string } | null
  scheduledDate?: string
}

/**
 * CourtControl AI: Visual bracket tree display.
 * Single elimination bracket'i R1 -> Final yatay akışla gösterir.
 * Her round kolon olarak, R1 solda, Final sağda.
 */
export default function TournamentBracket() {
  const { id } = useParams()
  const db = useFirestore()

  const tournamentRef = useMemoFirebase(() => {
    if (!db || !id) return null
    return doc(db, "tournaments", id as string)
  }, [db, id])
  const { data: tournament, loading: tourLoading } = useDoc(tournamentRef)
  const { t } = useI18n()

  const { data: allMatches } = useFilteredCollection<any>("matches", undefined, { limit: 500 })

  const matches = useMemo(() => {
    if (!allMatches || !id) return null
    return (allMatches as MatchRow[])
      .filter(m => m.tournamentId === id && m.round)
      .sort((a, b) => a.round - b.round || a.bracketPosition - b.bracketPosition)
  }, [allMatches, id])

  const rounds = useMemo(() => {
    if (!matches) return []
    const grouped: Record<number, MatchRow[]> = {}
    for (const m of matches) {
      if (!grouped[m.round]) grouped[m.round] = []
      grouped[m.round].push(m)
    }
    return Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b)
      .map(r => ({ round: r, matches: grouped[r] }))
  }, [matches])

  const totalRounds = rounds.length
  const getRoundLabel = (round: number) => {
    if (round === totalRounds) return 'Final'
    if (round === totalRounds - 1) return 'Semifinal'
    if (round === totalRounds - 2) return 'Quarterfinal'
    return `Round ${round}`
  }

  if (tourLoading) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-white">
      {/* Header */}
      <header className="border-b border-white/5 bg-card/40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href={`/tournaments/${id}`} className="flex items-center gap-2 text-muted-foreground hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Tournament</span>
          </Link>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <span className="font-bold uppercase tracking-tighter">Bracket Tree</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-headline font-bold uppercase tracking-tighter">
            {tournament?.name || "Tournament"} Bracket
          </h1>
          {tournament?.bracketGeneratedAt && (
            <p className="text-xs text-muted-foreground">
              Generated {new Date(tournament.bracketGeneratedAt).toLocaleString()}
              {tournament.totalRounds && ` · ${tournament.totalRounds} rounds`}
              {tournament.totalDays && ` · ${tournament.totalDays} day(s)`}
            </p>
          )}
        </div>

        {/* Quick nav */}
        <div className="flex items-center justify-center gap-3">
          <Link
            href={`/tournaments/${id}/leaderboard`}
            className="px-4 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-xl text-sm font-bold text-primary transition-colors"
          >
            View Leaderboard
          </Link>
          <Link
            href={`/tournaments/${id}/results`}
            className="px-4 py-2 bg-accent/10 hover:bg-accent/20 border border-accent/20 rounded-xl text-sm font-bold text-accent transition-colors"
          >
            View Results
          </Link>
        </div>

        {/* Bracket tree */}
        {rounds.length === 0 ? (
          <Card className="bg-card/50 border-border">
            <CardContent className="p-12 text-center">
              <Trophy className="h-16 w-16 mx-auto text-muted-foreground opacity-30 mb-4" />
              <h3 className="text-2xl font-headline font-bold mb-2">{t('bracket.noBracket')}</h3>
              <p className="text-muted-foreground">The bracket tree will appear once the organizer generates it.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-6 min-w-fit">
              {rounds.map(({ round, matches: roundMatches }) => (
                <div key={round} className="flex flex-col gap-3" style={{ minWidth: '240px' }}>
                  {/* Round header */}
                  <div className="text-center mb-2">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-bold uppercase tracking-widest">
                      {getRoundLabel(round)}
                    </Badge>
                  </div>

                  {/* Match cards */}
                  {roundMatches.map((m, idx) => {
                    const winnerIsA = m.winner?.team === "teamA"
                    const winnerIsB = m.winner?.team === "teamB"
                    const isComplete = m.status === "completed"
                    const isBye = m.status === "completed" && (m.teamA?.name === "TBD" || m.teamB?.name === "TBD")

                    // Visual spacing: each round's matches take more vertical space
                    const spacing = Math.pow(2, round - 1)

                    return (
                      <div
                        key={m.id}
                        style={{ marginTop: idx === 0 ? 0 : `${spacing * 60 - 30}px` }}
                        className={`relative p-3 rounded-xl border ${
                          isComplete
                            ? 'bg-card border-white/10'
                            : 'bg-secondary/20 border-white/5 border-dashed'
                        }`}
                      >
                        {/* Match # */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-muted-foreground">Match #{m.bracketPosition}</span>
                          {isComplete && !isBye && (
                            <Crown className="h-3 w-3 text-yellow-400" />
                          )}
                        </div>

                        {/* Team A */}
                        <div className={`p-2 rounded ${winnerIsA ? 'bg-emerald-500/10' : winnerIsB ? 'opacity-50' : ''}`}>
                          <div className="flex items-center justify-between">
                            <span className={`text-sm ${winnerIsA ? 'font-bold' : ''} truncate`}>
                              {m.teamA?.name || "TBD"}
                            </span>
                            {isComplete && !isBye && (
                              <span className="text-xs font-bold ml-2">
                                {m.winner?.team === "teamA" ? "✓" : ""}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="my-1 h-px bg-white/5" />

                        {/* Team B */}
                        <div className={`p-2 rounded ${winnerIsB ? 'bg-emerald-500/10' : winnerIsA ? 'opacity-50' : ''}`}>
                          <div className="flex items-center justify-between">
                            <span className={`text-sm ${winnerIsB ? 'font-bold' : ''} truncate`}>
                              {m.teamB?.name || "TBD"}
                            </span>
                            {isComplete && !isBye && (
                              <span className="text-xs font-bold ml-2">
                                {m.winner?.team === "teamB" ? "✓" : ""}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Day indicator */}
                        {m.scheduledDate && (
                          <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(m.scheduledDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30" />
            <span>Winner</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-card border border-white/10" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-secondary/20 border border-white/5 border-dashed" />
            <span>Pending</span>
          </div>
        </div>
      </main>
    </div>
  )
}
