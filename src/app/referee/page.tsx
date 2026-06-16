
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Zap, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react"

export default function RefereeConsole() {
  const [score1, setScore1] = useState(0)
  const [score2, setScore2] = useState(0)
  const [isVerifying, setIsVerifying] = useState(false)

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto border-x border-border">
      <header className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <Zap className="text-primary h-5 w-5" />
          <span className="font-headline font-bold">Referee Console</span>
        </div>
        <Badge variant="outline" className="text-accent border-accent">Court 1</Badge>
      </header>

      <main className="flex-1 p-4 flex flex-col gap-6">
        <div className="text-center space-y-1">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Spring Open • Quarter Finals</h2>
          <p className="text-lg font-headline font-bold">Pro Men's Singles</p>
        </div>

        {/* Player 1 Card */}
        <Card className={`overflow-hidden transition-all duration-300 ${score1 > score2 ? 'border-primary ring-1 ring-primary/30' : 'border-border'}`}>
          <CardContent className="p-6 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center font-headline text-2xl font-bold">MA</div>
            <div className="text-center">
              <h3 className="font-bold text-xl">Marco Rossi</h3>
              <p className="text-xs text-muted-foreground">ITA • Seed #2</p>
            </div>
            <div className="flex items-center gap-6">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-12 w-12 rounded-full border-2" 
                onClick={() => setScore1(Math.max(0, score1 - 1))}
              >
                -
              </Button>
              <span className="text-6xl font-headline font-bold">{score1}</span>
              <Button 
                variant="default" 
                size="icon" 
                className="h-12 w-12 rounded-full bg-primary"
                onClick={() => setScore1(score1 + 1)}
              >
                +
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground font-bold">VS</span>
          </div>
        </div>

        {/* Player 2 Card */}
        <Card className={`overflow-hidden transition-all duration-300 ${score2 > score1 ? 'border-primary ring-1 ring-primary/30' : 'border-border'}`}>
          <CardContent className="p-6 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center font-headline text-2xl font-bold">JL</div>
            <div className="text-center">
              <h3 className="font-bold text-xl">Juan Lopez</h3>
              <p className="text-xs text-muted-foreground">ESP • Seed #5</p>
            </div>
            <div className="flex items-center gap-6">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-12 w-12 rounded-full border-2" 
                onClick={() => setScore2(Math.max(0, score2 - 1))}
              >
                -
              </Button>
              <span className="text-6xl font-headline font-bold">{score2}</span>
              <Button 
                variant="default" 
                size="icon" 
                className="h-12 w-12 rounded-full bg-primary"
                onClick={() => setScore2(score2 + 1)}
              >
                +
              </Button>
            </div>
          </CardContent>
        </Card>

        {isVerifying ? (
          <div className="bg-accent/10 border border-accent rounded-xl p-6 text-center animate-in zoom-in-95">
            <ActivityIcon className="h-12 w-12 text-accent mx-auto mb-2 animate-pulse" />
            <h4 className="font-bold text-accent">Waiting for Player Approval</h4>
            <p className="text-xs text-muted-foreground mt-1">Verification request sent via Telegram to both players.</p>
          </div>
        ) : (
          <Button 
            className="w-full h-16 text-lg font-bold bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={() => setIsVerifying(true)}
          >
            Submit Score & Verify
          </Button>
        )}
      </main>

      <footer className="p-4 border-t border-border bg-card/50 grid grid-cols-2 gap-2">
        <Button variant="ghost" className="text-xs">Medical Timeout</Button>
        <Button variant="ghost" className="text-xs">Call Supervisor</Button>
      </footer>
    </div>
  )
}

function ActivityIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  )
}
