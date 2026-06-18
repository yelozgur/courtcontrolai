
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Building2, Mail, MapPin, Hash, Save, Loader2, Trophy, Image as ImageIcon } from "lucide-react"
import { useFirestore, useUser, useMemoFirebase, useCollection } from "@/firebase"
import { doc, setDoc, query, collection, where, limit } from "firebase/firestore"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
    logoUrl: ""
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
        logoUrl: clubData.logoUrl || ""
      })
    }
  }, [clubData])

  const handleSave = () => {
    if (!db || !clubId) {
      toast({
        variant: "destructive",
        title: "Identification Missing",
        description: "Could not find your club ID. Please refresh."
      })
      return
    }
    
    setIsSaving(true)
    
    const clubRef = doc(db, "clubs", clubId)
    const updateData = {
      ...formData,
      numCourts: Number(formData.numCourts) || 1
    }
    
    setDoc(clubRef, updateData, { merge: true })
      .then(() => {
        toast({
          title: "Settings Saved",
          description: "Your club profile has been updated."
        })
      })
      .catch(async (e) => {
        const error = new FirestorePermissionError({
          path: clubRef.path,
          operation: "update",
          requestResourceData: updateData
        })
        errorEmitter.emit("permission-error", error)
      })
      .finally(() => {
        setIsSaving(false)
      })
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
      <div>
        <h1 className="text-3xl font-headline font-bold uppercase tracking-tighter">Club Identity</h1>
        <p className="text-muted-foreground">Manage your organization's brand and global configuration.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
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
                    <SelectItem value="basketball">Basketball</SelectItem>
                    <SelectItem value="table-tennis">Table Tennis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="club-email">Contact Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="club-email" 
                  type="email"
                  className="pl-10"
                  value={formData.contactEmail} 
                  onChange={(e) => setFormData({...formData, contactEmail: e.target.value})}
                  placeholder="admin@club.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-card/50 border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-accent" />
                Brand Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center p-12">
               <div className="w-32 h-32 rounded-3xl bg-secondary flex items-center justify-center overflow-hidden border border-white/5 mb-4">
                  {formData.logoUrl ? (
                    <img src={formData.logoUrl} alt="Logo Preview" className="w-full h-full object-contain p-2" />
                  ) : (
                    <Building2 className="h-12 w-12 text-muted-foreground opacity-20" />
                  )}
               </div>
               <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">{formData.name || 'Your Club'}</p>
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
                className="w-full bg-primary"
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Sync Club Profile
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
