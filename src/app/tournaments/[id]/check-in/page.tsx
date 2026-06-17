
"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trophy, CheckCircle2, Loader2, MapPin, Search, LogIn, ArrowLeft, AlertCircle, Heart } from "lucide-react"
import { collection, addDoc, serverTimestamp, doc, query, where, getDocs, limit } from "firebase/firestore"
import { useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import Link from 'next/link';
import { cn } from "@/lib/utils"

export default function PublicCheckInPage() {
  const { id } = useParams()
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [email, setEmail] = useState("")
  const [selectedLocation, setSelectedLocation] = useState("")
  
  const tournamentRef = useMemoFirebase(() => {
    if (!db || !id) return null
    return doc(db, "tournaments", id as string)
  }, [db, id])

  const { data: tournament, loading: tournamentLoading, error: tournamentError } = useDoc(tournamentRef)

  // Fetch sponsors for branding
  const sponsorsQuery = useMemoFirebase(() => {
    if (!db || !tournament) return null;
    return query(collection(db, "sponsors"), where("clubId", "==", tournament.clubId));
  }, [db, tournament]);

  const { data: allSponsors } = useCollection(sponsorsQuery);

  // Filter sponsors that either support the club or this specific event
  const tournamentSponsors = allSponsors?.filter(s => 
    !s.tournamentId || s.tournamentId === id
  );

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !tournament) return
    
    setIsSubmitting(true)

    try {
      // Find participant
      const pQuery = query(
        collection(db, "participants"), 
        where("tournamentId", "==", id),
        where("email", "==", email.toLowerCase().trim()),
        limit(1)
      )
      
      const pSnap = await getDocs(pQuery)
      
      if (pSnap.empty) {
        toast({
          variant: "destructive",
          title: "Registration Required",
          description: "No player found with this email for this tournament."
        })
        setIsSubmitting(false)
        return
      }

      const participantId = pSnap.docs[0].id

      // Create Check-In
      const checkInData = {
        participantId,
        tournamentId: id,
        timestamp: serverTimestamp(),
        location: selectedLocation || tournament.locations?.[0] || "Main Venue"
      }

      await addDoc(collection(db, "checkins"), checkInData)
      setSubmitted(true)
      toast({ title: "Check-In Success", description: "You are now verified and ready to play." })
    } catch (e: any) {
      console.error("Check-in error:", e)
      toast({ 
        variant: "destructive", 
        title: "Check-In Failed", 
        description: "An error occurred. Please verify your connection." 
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (tournamentLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] gap-4">
        <Loader2 className="animate-spin text-primary h-12 w-12" />
        <p className="text-muted-foreground font-headline font-bold uppercase tracking-widest">Verifying Venue...</p>
      </div>
    )
  }

  if (tournamentError || !tournament) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] text-white p-6 text-center">
        <AlertCircle className="h-16 w-16 text-destructive mb-4 opacity-50" />
        <h2 className="text-3xl font-headline font-bold uppercase">Access Restricted</h2>
        <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
          Tournament details are unavailable. This may be due to security rules or the event being archived.
        </p>
        <Button asChild className="mt-8" variant="outline">
           <Link href="/tournaments">View All Events</Link>
        </Button>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-6 text-white text-center">
        <Card className="max-w-md w-full bg-card/50 border-white/5 p-12 backdrop-blur-xl">
          <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="h-12 w-12 text-primary" />
          </div>
          <h2 className="text-4xl font-headline font-bold mb-4 uppercase tracking-tighter">Verified</h2>
          <p className="text-muted-foreground mb-8 text-lg leading-relaxed">
            Welcome to <span className="text-white font-bold">{tournament.name}</span>.<br />
            You've successfully checked in at <span className="text-primary font-bold">{selectedLocation || "Main Venue"}</span>.
          </p>
          <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
            Done
          </Button>
        </Card>

        {tournamentSponsors && tournamentSponsors.length > 0 && (
          <div className="mt-12 text-center space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground opacity-50">Event Partners</p>
            <div className="flex flex-wrap justify-center gap-8">
              {tournamentSponsors.map(s => (
                <img key={s.id} src={s.logoUrl} alt={s.name} className="h-10 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-pointer" />
              ))}
            </div>
          </div>
        )}
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
          <h1 className="text-4xl font-headline font-bold uppercase tracking-tighter leading-none">Venue Arrival</h1>
          <p className="text-lg text-muted-foreground font-medium mt-2">{tournament.name}</p>
        </div>
      </div>

      <Card className="max-w-md w-full bg-card/40 border-white/5 shadow-2xl backdrop-blur-xl overflow-hidden">
        <div className="h-2 bg-primary"></div>
        <CardHeader className="text-center pt-10">
          <CardTitle className="font-headline font-bold uppercase text-2xl">Confirm Check-In</CardTitle>
          <CardDescription>Enter your email to verify your tournament entry.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCheckIn} className="space-y-6">
            <div className="space-y-2">
              <Label className="uppercase tracking-widest text-[10px] font-bold opacity-60">Registered Email</Label>
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

            {tournament.locations && tournament.locations.length > 0 && (
              <div className="space-y-2">
                <Label className="uppercase tracking-widest text-[10px] font-bold opacity-60">Current Location</Label>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="bg-white/5 border-white/10 h-12">
                    <SelectValue placeholder="Select Venue" />
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
              Verify Arrival
            </Button>
          </form>
        </CardContent>
      </Card>

      {tournamentSponsors && tournamentSponsors.length > 0 && (
        <div className="mt-12 text-center space-y-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-muted-foreground flex items-center justify-center gap-3">
             <Heart className="h-3 w-3 text-primary" /> Supported By
          </p>
          <div className="flex flex-wrap justify-center gap-10">
            {tournamentSponsors.map(s => (
              <img 
                key={s.id} 
                src={s.logoUrl} 
                alt={s.name} 
                className={cn(
                  "opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-pointer",
                  s.tier === "gold" ? "h-10" : s.tier === "silver" ? "h-8" : "h-6"
                )} 
              />
            ))}
          </div>
        </div>
      )}
      
      <p className="mt-8 text-muted-foreground text-xs text-center flex items-center gap-2">
        <ArrowLeft className="h-3 w-3" /> <Link href="/tournaments" className="hover:text-primary transition-colors underline">Browse Other Events</Link>
      </p>
    </div>
  )
}
