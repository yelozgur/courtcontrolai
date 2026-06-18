
"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, Loader2, MapPin, Building, Heart } from "lucide-react"
import { collection, addDoc, serverTimestamp, doc, query, where, getDocs, limit } from "firebase/firestore"
import { useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import Image from "next/image"
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

  const { data: tournament, loading: tournamentLoading } = useDoc(tournamentRef)

  // Fetch club details
  const clubRef = useMemoFirebase(() => {
    if (!db || !tournament?.clubId) return null;
    return doc(db, "clubs", tournament.clubId);
  }, [db, tournament]);
  const { data: club } = useDoc(clubRef);

  // Fetch sponsors
  const sponsorsQuery = useMemoFirebase(() => {
    if (!db || !tournament?.clubId) return null;
    return query(collection(db, "sponsors"), where("clubId", "==", tournament.clubId));
  }, [db, tournament]);
  const { data: allSponsors } = useCollection(sponsorsQuery);

  const tournamentSponsors = allSponsors?.filter(s => 
    !s.tournamentId || s.tournamentId === id
  );

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !tournament) return
    if (tournament.locations?.length > 1 && !selectedLocation) {
      toast({ variant: "destructive", title: "Location Required" })
      return
    }
    
    setIsSubmitting(true)
    try {
      const pQuery = query(
        collection(db, "participants"), 
        where("tournamentId", "==", id),
        where("email", "==", email.toLowerCase().trim()),
        limit(1)
      )
      const pSnap = await getDocs(pQuery)
      if (pSnap.empty) {
        toast({ variant: "destructive", title: "Player Not Found", description: "Register for the event first." })
        setIsSubmitting(false)
        return
      }

      const participantId = pSnap.docs[0].id
      const checkInData = {
        participantId,
        tournamentId: id,
        timestamp: serverTimestamp(),
        location: selectedLocation || (tournament.locations?.[0]?.name || "Main Venue")
      }
      
      addDoc(collection(db, "checkins"), checkInData)
        .then(() => {
          setSubmitted(true)
        })
        .catch(async (err) => {
          const error = new FirestorePermissionError({
            path: "checkins",
            operation: 'create',
            requestResourceData: checkInData
          });
          errorEmitter.emit('permission-error', error);
        })
        .finally(() => {
          setIsSubmitting(false)
        })

    } catch (e) {
      toast({ variant: "destructive", title: "Check-In Error" })
      setIsSubmitting(false)
    }
  }

  if (tournamentLoading) return <div className="min-h-screen flex items-center justify-center bg-[#0F172A]"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-6 text-white text-center">
        <Card className="max-w-md w-full bg-card/50 border-white/5 p-12 backdrop-blur-xl shadow-2xl">
          <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="h-12 w-12 text-primary" />
          </div>
          <h2 className="text-4xl font-headline font-bold mb-4 uppercase">Verified</h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Welcome to <span className="text-white font-bold">{tournament?.name}</span>. Arrival verified.
          </p>
          <Button onClick={() => window.location.reload()} variant="outline" className="w-full">Done</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-6 text-white">
      <div className="mb-10 text-center space-y-4">
        {club?.logoUrl ? (
          <div className="relative w-16 h-16 mx-auto mb-4">
            <Image src={club.logoUrl} fill className="object-contain" alt={club.name} />
          </div>
        ) : (
          <MapPin className="h-12 w-12 text-primary mx-auto mb-4 shadow-2xl shadow-primary/20" />
        )}
        <h1 className="text-4xl font-headline font-bold uppercase tracking-tighter leading-none">Venue Arrival</h1>
        <p className="text-lg text-muted-foreground font-medium">{tournament?.name}</p>
      </div>

      <Card className="max-w-md w-full bg-card/40 border-white/5 shadow-2xl backdrop-blur-xl overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-accent to-primary"></div>
        <CardHeader className="text-center pt-10">
          <CardTitle className="font-headline font-bold uppercase text-2xl">Confirm Check-In</CardTitle>
          <CardDescription>Verify your location context.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCheckIn} className="space-y-6">
            <div className="space-y-2">
              <Label className="uppercase tracking-widest text-[10px] font-bold opacity-60">Registered Email</Label>
              <Input required type="email" className="bg-white/5 border-white/10 h-12 text-lg" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>

            {tournament?.locations?.length > 0 && (
              <div className="space-y-2">
                <Label className="uppercase tracking-widest text-[10px] font-bold opacity-60">Playing At</Label>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="bg-white/5 border-white/10 h-12">
                    <Building className="w-4 h-4 mr-2 opacity-50" />
                    <SelectValue placeholder="Select venue..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tournament.locations.map((loc: any, i: number) => (
                      <SelectItem key={i} value={typeof loc === 'object' ? loc.name : loc}>{typeof loc === 'object' ? loc.name : loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <Button type="submit" className="w-full h-14 text-xl font-bold bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 uppercase tracking-widest" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin mr-2 h-6 w-6" /> : <MapPin className="mr-2 h-6 w-6" />}
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
              <div key={s.id} className="relative h-10 w-24 grayscale opacity-30 hover:grayscale-0 hover:opacity-100 transition-all">
                <Image src={s.logoUrl} alt={s.name} fill className="object-contain" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
