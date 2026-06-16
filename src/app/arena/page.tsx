
"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Trophy, Zap, Clock, Users, ArrowRight } from "lucide-react"

export default function ArenaDashboard() {
  const [time, setTime] = useState<Date | null>(null)

  useEffect(() => {
    setTime(new Date())
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="min-h-screen bg-[#0F172A] text-white p-8 font-body overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-[#8B5CF6] rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
            <Zap className="h-10 w-10 text-white" />
          </div>
          <div>
            <h1 className="text-5xl font-headline font-bold tracking-tighter uppercase">CourtControl AI</h1>
            <p className="text-xl text-muted-foreground font-medium">Spring Padel Open • Live Results</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-5xl font-mono font-bold">
            {time ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
          </div>
          <div className="text-xl text-accent font-bold uppercase tracking-widest mt-1">Arena Mode Active</div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-3 gap-8 flex-1">
        {/* Left Column: Live Scores */}
        <div className="col-span-2 space-y-8">
          <h2 className="text-3xl font-headline font-bold flex items-center gap-4">
            <span className="w-4 h-4 rounded-full bg-accent animate-pulse"></span>
            Live On Courts
          </h2>
          
          <div className="grid gap-6">
            {[1, 2, 3, 4].map((court) => (
              <div key={court} className="bg-card/40 border border-white/5 rounded-3xl p-8 flex items-center gap-12 backdrop-blur-md relative overflow-hidden group">
                <div className="absolute top-0 left-0 h-full w-2 bg-accent"></div>
                
                <div className="text-center">
                  <span className="block text-sm text-muted-foreground uppercase font-bold tracking-[0.2em] mb-2">Court</span>
                  <span className="block text-7xl font-headline font-bold">{court}</span>
                </div>

                <div className="flex-1 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-2xl font-bold">AB</div>
                      <span className="text-3xl font-bold">Team Smith / Jones</span>
                    </div>
                    <span className="text-6xl font-mono font-bold text-accent">6</span>
                  </div>
                  <div className="h-px bg-white/5"></div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-2xl font-bold">XY</div>
                      <span className="text-3xl font-bold">Team Brown / White</span>
                    </div>
                    <span className="text-6xl font-mono font-bold opacity-50">4</span>
                  </div>
                </div>

                <div className="text-right pl-12 border-l border-white/5">
                  <Badge className="bg-primary/20 text-primary border-primary mb-4 text-lg px-6 py-2">SET 2</Badge>
                  <p className="text-muted-foreground font-mono">24m played</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Upcoming & Stats */}
        <div className="space-y-12">
          <div className="bg-[#1E293B] rounded-3xl p-8 h-full border border-white/5">
            <h2 className="text-3xl font-headline font-bold mb-8 flex items-center gap-4">
              <Clock className="h-8 w-8 text-primary" />
              Next Up
            </h2>
            <div className="space-y-8">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-6 items-center p-4 rounded-2xl hover:bg-white/5 transition-colors">
                  <div className="w-20 text-center py-3 bg-white/5 rounded-2xl">
                    <span className="block text-lg font-bold">1{i}:00</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold">Semi-Finals</h4>
                    <p className="text-muted-foreground text-sm uppercase tracking-wide">Category B • Court {i}</p>
                  </div>
                  <ArrowRight className="h-6 w-6 text-muted-foreground" />
                </div>
              ))}
            </div>

            <div className="mt-12 pt-12 border-t border-white/5">
                <div className="bg-primary/10 rounded-3xl p-6 text-center">
                    <Users className="h-10 w-10 text-primary mx-auto mb-4" />
                    <h3 className="text-2xl font-headline font-bold">Check-In Required</h3>
                    <p className="text-muted-foreground mt-2">Scan the QR at the entrance to update your Telegram handle for match notifications.</p>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
