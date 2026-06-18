
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Building2, Mail, MapPin, Hash, Save, Loader2, Trophy, Image as ImageIcon, Send, MessageSquare, Globe, PlusCircle } from "lucide-react"
import { useFirestore, useUser, useMemoFirebase, useCollection } from "@/firebase"
import { doc, setDoc, query, collection, where, limit, addDoc, serverTimestamp } from "firebase/firestore"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const COMMON_TIMEZONES = [
  { label: "UTC -12:00", value: "Etc/GMT+12" },
  { label: "UTC -11:00", value: "Etc/GMT+11" },
  { label: "UTC -10:00", value: "Etc/GMT+10" },
  { label: "UTC -09:00", value: "Etc/GMT+9" },
  { label: "UTC -08:00", value: "Etc/GMT+8" },
  { label: "UTC -07:00", value: "Etc/GMT+7" },
  { label: "UTC -06:00", value: "Etc/GMT+6" },
  { label: "UTC -05:00", value: "Etc/GMT+5" },
  { label: "UTC -04:00", value: "Etc/GMT+4" },
  { label: "UTC -03:00", value: "Etc/GMT+3" },
  { label: "UTC -02:00", value: "Etc/GMT+2" },
  { label: "UTC -01:00", value: "Etc/GMT+1" },
  { label: "UTC +00:00", value: "UTC" },
  { label: "UTC +01:00", value: "Etc/GMT-1" },
  { label: "UTC +02:00", value: "Etc/GMT-2" },
  { label: "UTC +03:00", value: "Etc/GMT-3" },
  { label: "UTC +04:00", value: "Etc/GMT-4" },
  { label: "UTC +05:00", value: "Etc/GMT-5" },
  { label: "UTC +06:00", value: "Etc/GMT-6" },
  { label: "UTC +07:00", value: "Etc/GMT-7" },
  { label: "UTC +08:00", value: "Etc/GMT-8" },
  { label: "UTC +09:00", value: "Etc/GMT-9" },
  { label: "UTC +10:00", value: "Etc/GMT-10" },
  { label: "UTC +11:00", value: "Etc/GMT-11" },
  { label: "UTC +12:00", value: "Etc/GMT-12" },
]

export default function ClubSettings() {
  const db = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()
  
  const clubsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "clubs"), where("ownerId", "==", user.uid), limit(1))
  }, [db, user])

  const { data: userClubs, loading } = useCollection(clubsQuery)
  const clubData = userClubs?.[0]
  const clubId = clubData?.id
  
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    contactEmail: "",
    numCourts: 1,
    primarySport: "padel",
    logoUrl: "",
    timezone: "UTC",
    telegramBotToken: "",
    telegramBotUsername: ""
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (clubData) {
      setFormData({
        name: clubData.name || "",
        location: clubData.location || "",
        contactEmail: clubData.contactEmail || "",
        numCourts: clubData.numCourts || 1,
        primarySport: clubData.primarySport || "padel",
        logoUrl: clubData.logoUrl || "",
        timezone: clubData.timezone || "UTC",
        telegramBotToken: clubData.telegramBotToken || "",
        telegramBotUsername: clubData.telegramBotUsername || ""
      })
    } else if (user) {
      setFormData(prev => ({ ...prev, contactEmail: user.email || "" }))
    }
  }, [clubData, user])

  const handleSave = () => {
    if (!db || !user) return
    
    setIsSaving(true)
    
    const updateData = {
      ...formData,
      ownerId: user.uid,
      numCourts: Number(formData.numCourts) || 1,
      updatedAt: serverTimestamp()
    }

    if (clubId) {
      const clubRef = doc(db, "clubs", clubId)
      setDoc(clubRef, updateData, { merge: true })
        .then(() => {
          toast({ title: "Settings Saved", description: "Your club profile has been updated." })
        })
        .catch(async (e) => {
          const error = new FirestorePermissionError({
            path: clubRef.path,
            operation: "update",
            requestResourceData: updateData
          })
          errorEmitter.emit("permission-error", error)
        })
        .finally(() => setIsSaving(false))
    } else {
      addDoc(collection(db, "clubs"), { ...updateData, createdAt: serverTimestamp() })
        .then(() => {
          toast({ title: "Club Initialized", description: "Your organization is now active." })
        })
        .catch(async (e) => {
          const error = new FirestorePermissionError({
            path: "clubs",
            operation: "create",
            requestResourceData: updateData
          })
          errorEmitter.emit("permission-error", error)
        })
        .finally(() => setIsSaving(false))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold uppercase tracking-tighter text-white">Club Identity</h1>
          <p className="text-muted-foreground font-medium">Manage your organization's brand and operating timezone.</p>
        </div>
        {!clubId && (
          <Badge variant="outline" className="border-primary text-primary bg-primary/5 px-4 h-8 uppercase tracking-widest font-bold animate-pulse">
             Registration Pending
          </Badge>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <Card className="bg-card/50 border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                General Information
              </CardTitle>
              <CardDescription>Basic details about your sports organization.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="club-name">Club Name</Label>
                <Input 
                  id="club-name" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Ace Padel Club"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Club Timezone (UTC Offset)</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
                  <Select 
                    value={formData.timezone} 
                    onValueChange={(val) => setFormData({...formData, timezone: val})}
                  >
                    <SelectTrigger className="pl-10">
                      <SelectValue placeholder="Select UTC offset" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_TIMEZONES.map(tz => (
                        <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Club Logo URL</Label>
                <div className="relative">
                  <ImageIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    className="pl-10"
                    value={formData.logoUrl} 
                    onChange={(e) => setFormData({...formData, logoUrl: e.target.value})}
                    placeholder="https://example.com/logo.png"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="primary-sport">Primary Sport Type</Label>
                <div className="relative">
                  <Trophy className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
                  <Select 
                    value={formData.primarySport} 
                    onValueChange={(val) => setFormData({...formData, primarySport: val})}
                  >
                    <SelectTrigger className="pl-10">
                      <SelectValue placeholder="Select primary sport" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="padel">Padel</SelectItem>
                      <SelectItem value="tennis">Tennis</SelectItem>
                      <SelectItem value="badminton">Badminton</SelectItem>
                      <SelectItem value="pickleball">Pickleball</SelectItem>
                      <SelectItem value="squash">Squash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1E293B] border-primary/20 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary font-headline">
                <Send className="h-5 w-5" />
                Telegram Bot Integration
              </CardTitle>
              <CardDescription>Automate player notifications with your club's bot.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white">Bot API Token</Label>
                <Input 
                  type="password"
                  placeholder="123456789:ABCDefGhIjK..." 
                  value={formData.telegramBotToken}
                  onChange={(e) => setFormData({...formData, telegramBotToken: e.target.value})}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white">Bot Username</Label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="MyClubBot" 
                    className="pl-10 bg-background/50"
                    value={formData.telegramBotUsername}
                    onChange={(e) => setFormData({...formData, telegramBotUsername: e.target.value.replace('@', '')})}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-card/50 border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-accent" />
                Brand Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
               <div className="w-32 h-32 rounded-3xl bg-secondary flex items-center justify-center overflow-hidden border border-white/5 mb-4">
                  {formData.logoUrl ? (
                    <img src={formData.logoUrl} alt="Logo Preview" className="w-full h-full object-contain p-2" />
                  ) : (
                    <Building2 className="h-12 w-12 text-muted-foreground opacity-20" />
                  )}
               </div>
               <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">{formData.name || 'Organization Name'}</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-accent" />
                Venue Capacity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="num-courts">Global Court Count</Label>
                <Input 
                  id="num-courts" 
                  type="number" 
                  min="1"
                  value={formData.numCourts} 
                  onChange={(e) => setFormData({...formData, numCourts: parseInt(e.target.value) || 1})}
                />
              </div>
              <Button 
                onClick={handleSave} 
                className="w-full bg-primary h-12 text-lg font-bold"
                disabled={isSaving || !formData.name}
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (clubId ? <Save className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)}
                {clubId ? 'Update Club Profile' : 'Launch Organization'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
