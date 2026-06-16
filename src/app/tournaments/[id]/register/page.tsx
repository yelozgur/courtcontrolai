
"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trophy, CheckCircle2, Loader2, User, Mail, Send } from "lucide-react"
import { collection, addDoc, serverTimestamp, doc } from "firebase/firestore"
import { useFirestore, useDoc } from "@/firebase"
import { useToast } from "@/hooks/use-toast"

export default function TournamentRegistration() {
  const { id } = useParams()
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  
  const tournamentRef = db ? doc(db, "tournaments", id as string) : null
  const { data: tournament, loading: tournamentLoading } = useDoc(tournamentRef)

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    telegramHandle: "",
    skillLevel: "intermediate"
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !tournament) return
    setIsSubmitting(true)
    
    try {
      await addDoc(collection(db, "participants"), {
        ...formData,
        clubId: tournament.clubId, // Tag with the tournament's clubId
        tournamentId: id,
        registeredAt: serverTimestamp()
      })
      setSubmitted(true)
      toast({ title: "Registration Successful!", description: "You've been added to the tournament roster." })
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Could not complete registration." })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (tournamentLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0F172A]"><Loader2 className="animate-spin text-primary h-10 w-10" /></div>
  }

  if (!tournament) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0F172A] text-white">Tournament not found</div>
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6 text-white">
        <Card className="max-w-md w-full bg-card/50 border-white/5 text-center p-8">
          <CheckCircle2 className="h-20 w-20 text-emerald-500 mx-auto mb-6" />
          <h2 className="text-3xl font-headline font-bold mb-2">You're In!</h2>
          <p className="text-muted-foreground mb-8">
            Registration for <span className="text-white font-bold">{tournament.name}</span> is confirmed. 
            Check your email for further instructions.
          </p>
          <Button onClick={() => router.push("/tournaments")} className="w-full">
            Back to Tournaments
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-6 text-white">
      <div className="mb-10 text-center">
        <Trophy className="h-12 w-12 text-primary mx-auto mb-4" />
        <h1 className="text-3xl font-headline font-bold uppercase tracking-tighter">Event Registration</h1>
        <p className="text-muted-foreground">{tournament.name}</p>
      </div>

      <Card className="max-w-lg w-full bg-card/50 border-white/5 shadow-2xl">
        <CardHeader>
          <CardTitle>Player Details</CardTitle>
          <CardDescription>Fill out the form below to secure your spot in the bracket.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  required
                  className="pl-10 bg-white/5 border-white/10"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  required
                  type="email"
                  className="pl-10 bg-white/5 border-white/10"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Skill Level</Label>
                <Select value={formData.skillLevel} onValueChange={val => setFormData({...formData, skillLevel: val})}>
                  <SelectTrigger className="bg-white/5 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Telegram Handle</Label>
                <div className="relative">
                  <Send className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    className="pl-10 bg-white/5 border-white/10"
                    placeholder="@username"
                    value={formData.telegramHandle}
                    onChange={e => setFormData({...formData, telegramHandle: e.target.value})}
                  />
                </div>
              </div>
            </div>
            <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : null}
              Confirm Registration
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
