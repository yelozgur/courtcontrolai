
"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trophy, CheckCircle2, Loader2, MapPin, Search, LogIn, ArrowLeft } from "lucide-react"
import { collection, addDoc, serverTimestamp, doc, query, where, getDocs, limit } from "firebase/firestore"
import { useFirestore, useDoc } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import Link from 'next/link';

export default function PublicCheckInPage() {
  const { id } = useParams()
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [email, setEmail] = useState("")
  const [selectedLocation, setSelectedLocation] = useState("")
  
  const tournamentRef = db ? doc(db, "tournaments", id as string) : null
  const { data: tournament, loading: tournamentLoading } = useDoc(tournamentRef)

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !tournament) return
    
    setIsSubmitting(true)

    try {
      // 1. Find participant by email
      const pQuery = query(
        collection(db, "participants"), 
        where("tournamentId", "==", id),
        where("email", "==", email.toLowerCase()),
        limit(1)
      )
      const pSnap = await getDocs(pQuery)
      
      if (pSnap.empty) {
        toast({
          variant: "destructive",
          title: "Player Not Found",
          description: "You must be registered for this tournament before checking in."
        })
        setIsSubmitting(false)
        return
      }

      const participant = pSnap.docs[0]
      const participantId = participant.id

      // 2. Create Check-In record
      const checkInData = {
        participantId,
        tournamentId: id,
        timestamp: serverTimestamp(),
        date: new Date().toISOString().split('T')[0],
        location: selectedLocation || tournament.locations?.[0] || "Main Venue"
      }

      await addDoc(collection(db, "checkins"), checkInData)
      setSubmitted(true)
      toast({ title: "Welcome!", description: "You are checked in and match-ready." })
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Could not complete check-in." })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (tournamentLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] gap-4">
        <Loader2 className="animate-spin text-primary h-12 w-12" />
        <p className="text-muted-foreground font-headline font-bold uppercase tracking-widest animate-pulse">Syncing Venue Data...</p>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] text-white p-6 text-center">
        <Trophy className="h-16 w-16 text-muted-foreground mb-4 opacity-20" />
        <h2 className="text-3xl font-headline font-bold uppercase">Invalid Event</h2>
        <p className="text-muted-foreground mt-2">Check-in session expired or event not found.</p>
        <Button asChild className="mt-8" variant="outline">
           <Link href="/tournaments">Find Events</Link>
        </Button>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6 text-white text-center">
        <Card className="max-w-md w-full bg-card/50 border-white/5 p-12 backdrop-blur-xl">
          <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="h-12 w-12 text-primary" />
          </div>
          <h2 className="text-4xl font-headline font-bold mb-4 uppercase tracking-tighter">You're In!</h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Welcome to <span className="text-white font-bold">{tournament.name}</span>.<br />
            Location: <span className="text-primary font-bold">{selectedLocation || tournament.locations?.[0] || "Main Venue"}</span><br /><br />
            Please wait in the player area. We'll notify you when your court is ready.
          </p>
          <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
            New Check-In
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-6 text-white">
      <div className="mb-10 text-center space-y-4">
        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto shadow-2xl shadow-primary/20">
          <MapPin className="h-8 w-8 text-white" />
        </div>
        <div>
          <h1 className="text-4xl font-headline font-bold uppercase tracking-tighter leading-none">Venue Check-In</h1>
          <p className="text-lg text-muted-foreground font-medium mt-2">{tournament.name}</p>
        </div>
      </div>

      <Card className="max-w-md w-full bg-card/40 border-white/5 shadow-2xl backdrop-blur-xl overflow-hidden relative">
        <div className="h-2 bg-primary"></div>
        <div className="absolute top-4 left-4">
           <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
             <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Home</Link>
           </Button>
        </div>
        <CardHeader className="text-center pt-16">
          <CardTitle className="font-headline font-bold uppercase text-2xl">Confirm Arrival</CardTitle>
          <CardDescription>Day-of verification for registered players.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCheckIn} className="space-y-6">
            <div className="space-y-2">
              <Label className="uppercase tracking-widest text-[10px] font-bold opacity-60">Your Registered Email</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  required
                  type="email"
                  className="pl-10 bg-white/5 border-white/10 h-12 text-lg"
                  placeholder="name@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            {tournament.locations && tournament.locations.length > 1 && (
              <div className="space-y-2">
                <Label className="uppercase tracking-widest text-[10px] font-bold opacity-60">Arrival Location</Label>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="bg-white/5 border-white/10 h-12">
                    <SelectValue placeholder="Select current location" />
                  </SelectTrigger>
                  <SelectContent>
                    {tournament.locations.map((loc: string, i: number) => (
                      <SelectItem key={i} value={loc}>{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <Button type="submit" className="w-full h-14 text-xl font-bold bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 uppercase tracking-widest" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin mr-2 h-6 w-6" /> : <LogIn className="mr-2 h-6 w-6" />}
              Check In Now
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <p className="mt-8 text-muted-foreground text-xs max-w-xs text-center">
        Pre-event registration is required. If you haven't registered, please use the registration link provided by the organizer.
      </p>
    </div>
  )
}
