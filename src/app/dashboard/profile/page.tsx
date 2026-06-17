
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useUser, useFirestore, useMemoFirebase, useCollection, useDoc } from "@/firebase"
import { collection, query, where, orderBy, doc } from "firebase/firestore"
import { Trophy, Calendar, CheckCircle, Clock, MapPin, User, Mail, Award, Loader2 } from "lucide-react"

export default function PlayerProfile() {
  const { user } = useUser()
  const db = useFirestore()

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, "users", user.uid)
  }, [db, user])

  const { data: profile } = useDoc(userProfileRef)

  const registrationsQuery = useMemoFirebase(() => {
    if (!db || !user?.email) return null
    return query(
      collection(db, "participants"),
      where("email", "==", user.email.toLowerCase())
    )
  }, [db, user])

  const { data: registrations, loading: regsLoading } = useCollection(registrationsQuery)

  const checkinsQuery = useMemoFirebase(() => {
    if (!db || !registrations || registrations.length === 0) return null
    const participantIds = registrations.map(r => r.id)
    // Firestore limited to 10 in query for IN, so we filter or chunk if needed
    // For MVP, we'll assume a player doesn't have hundreds of active registrations
    return query(
      collection(db, "checkins"),
      where("participantId", "in", participantIds.slice(0, 10)),
      orderBy("timestamp", "desc")
    )
  }, [db, registrations])

  const { data: checkins, loading: checkinsLoading } = useCollection(checkinsQuery)

  if (!user) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row items-center gap-6 p-8 bg-card/30 rounded-3xl border border-white/5 backdrop-blur-xl">
        <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center text-3xl font-bold shadow-2xl shadow-primary/20">
          {profile?.displayName?.charAt(0) || user.email?.charAt(0).toUpperCase()}
        </div>
        <div className="text-center md:text-left space-y-1">
          <h1 className="text-3xl font-headline font-bold text-white uppercase tracking-tighter">
            {profile?.displayName || "Competitor"}
          </h1>
          <div className="flex flex-wrap justify-center md:justify-start gap-3">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Mail className="h-3 w-3" /> {user.email}
            </Badge>
            <Badge variant="outline" className="border-accent text-accent">
              {profile?.role?.toUpperCase() || "PLAYER"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" /> My Tournaments
          </h2>
          <div className="grid gap-4">
            {regsLoading ? (
              <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>
            ) : registrations && registrations.length > 0 ? (
              registrations.map((reg) => (
                <Card key={reg.id} className="bg-white/5 border-white/5 hover:border-primary/20 transition-all group">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <Award className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">{reg.categoryName || "Open"}</h4>
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          Skill: <span className="text-accent font-bold uppercase">{reg.skillLevel || 'N/A'}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                       <Badge variant="outline" className="text-[10px] mb-2">REGISTERED</Badge>
                       <p className="text-[10px] text-muted-foreground">ID: {reg.id.slice(-6).toUpperCase()}</p>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-16 bg-white/5 rounded-3xl border-dashed border-2 border-white/5">
                <User className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">You haven't registered for any tournaments yet.</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
            <Clock className="h-6 w-6 text-accent" /> Arrival History
          </h2>
          <div className="space-y-4">
            {checkinsLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-accent" /></div>
            ) : checkins && checkins.length > 0 ? (
              checkins.map((check) => (
                <Card key={check.id} className="bg-white/5 border-white/5">
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Checked In</p>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3" /> {check.location}
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        {check.timestamp?.toDate ? check.timestamp.toDate().toLocaleString() : "Just now"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-10 italic text-sm">No check-in history yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
