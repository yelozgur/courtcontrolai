
"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Trophy, Save, Loader2, ArrowLeft, Trash2, Plus, Layout, Lock, Unlock, Users, Monitor, Gavel, AlertCircle, Clock, Zap, MapPin, DollarSign, Shirt } from "lucide-react"
import { doc, updateDoc, deleteDoc } from "firebase/firestore"
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"

interface Category {
  id: string;
  name: string;
  format: string;
  sets: number;
  ageGroup: string;
  isTeamBased: boolean;
}

interface LocationEntry {
  name: string;
  numCourts: number;
}

export default function EditTournamentPage() {
  const { id } = useParams()
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  
  const tournamentRef = useMemoFirebase(() => {
    if (!db || !id) return null
    return doc(db, "tournaments", id as string)
  }, [db, id])

  const { data: tournament, loading } = useDoc(tournamentRef)
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
    sport: "",
    status: "draft",
    entryFee: 0,
    numCourts: 0,
    matchDuration: 60,
    recoveryTime: 15,
    hasWelcomePack: false,
    welcomePackDescription: "",
    requiresSize: false,
    locations: [] as LocationEntry[],
    categories: [] as Category[],
    referees: [] as string[]
  })
  
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [newRefereeEmail, setNewRefereeEmail] = useState("")
  
  const [newLocName, setNewLocName] = useState("")
  const [newLocCourts, setNewLocCourts] = useState(1)

  const isDraft = formData.status === "draft"
  const isOperational = ["registration", "active"].includes(formData.status)
  const isCompleted = formData.status === "completed"

  useEffect(() => {
    if (tournament) {
      setFormData({
        name: tournament.name || "",
        description: tournament.description || "",
        startDate: tournament.startDate || "",
        endDate: tournament.endDate || "",
        sport: tournament.sport || "padel",
        status: tournament.status || "draft",
        entryFee: tournament.entryFee || 0,
        numCourts: tournament.numCourts || 0,
        matchDuration: tournament.matchDuration || 60,
        recoveryTime: tournament.recoveryTime || 15,
        hasWelcomePack: tournament.hasWelcomePack || false,
        welcomePackDescription: tournament.welcomePackDescription || "",
        requiresSize: tournament.requiresSize || false,
        locations: tournament.locations || [],
        categories: tournament.categories || [],
        referees: tournament.referees || []
      })
    }
  }, [tournament])

  useEffect(() => {
    const total = formData.locations.reduce((acc, loc) => acc + loc.numCourts, 0);
    setFormData(prev => ({ ...prev, numCourts: total }));
  }, [formData.locations]);

  const handleSave = () => {
    if (!db || !id) return

    if (formData.entryFee > 0 && formData.entryFee < 5) {
      toast({ variant: "destructive", title: "Minimum Fee Required", description: "Entry fee must be at least $5.00 for accounting viability." })
      return
    }

    setIsSaving(true)
    
    const docRef = doc(db, "tournaments", id as string)
    const updateData = {
      ...formData,
      entryFee: Number(formData.entryFee) || 0,
      numCourts: Number(formData.numCourts) || 0,
      matchDuration: Number(formData.matchDuration),
      recoveryTime: Number(formData.recoveryTime)
    }

    updateDoc(docRef, updateData)
      .then(() => {
        toast({ title: "Tournament Updated", description: "All changes have been synced." })
      })
      .catch(async (e) => {
        const error = new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: updateData
        })
        errorEmitter.emit("permission-error", error)
      })
      .finally(() => setIsSaving(false))
  }

  const handleDelete = () => {
    if (!db || !id || !confirm("Are you sure you want to delete this tournament? This cannot be undone.")) return
    setIsDeleting(true)
    deleteDoc(doc(db, "tournaments", id as string))
      .then(() => {
        toast({ title: "Tournament Deleted" })
        router.push("/dashboard")
      })
      .finally(() => setIsDeleting(false))
  }

  const addCategory = () => {
    const newCat: Category = {
      id: Math.random().toString(36).substr(2, 9),
      name: "New Category",
      format: "Single Elimination",
      sets: 3,
      ageGroup: "Open",
      isTeamBased: false
    }
    setFormData({ ...formData, categories: [...formData.categories, newCat] })
  }

  const updateCategory = (catId: string, field: string, value: any) => {
    setFormData({
      ...formData,
      categories: formData.categories.map(c => c.id === catId ? { ...c, [field]: value } : c)
    })
  }

  const removeCategory = (catId: string) => {
    setFormData({ ...formData, categories: formData.categories.filter(c => c.id !== catId) })
  }

  const addReferee = () => {
    if (!newRefereeEmail) return
    if (!formData.referees.includes(newRefereeEmail.toLowerCase())) {
      setFormData({ ...formData, referees: [...formData.referees, newRefereeEmail.toLowerCase()] })
    }
    setNewRefereeEmail("")
  }

  const addLocation = () => {
    if (!newLocName) return
    setFormData({
      ...formData,
      locations: [...formData.locations, { name: newLocName, numCourts: newLocCourts }]
    })
    setNewLocName("")
    setNewLocCourts(1)
  }

  const removeLocation = (index: number) => {
    setFormData({ ...formData, locations: formData.locations.filter((_, i) => i !== index) })
  }

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")} className="hover:bg-white/5">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-headline font-bold">Tournament Control</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={isDraft ? "outline" : "secondary"}>
                {isDraft ? <Unlock className="w-3 h-3 mr-1" /> : <Lock className="w-3 h-3 mr-1" />}
                {formData.status.toUpperCase()}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
           <Button variant="outline" onClick={() => router.push(`/arena/${id}`)}>
             <Monitor className="mr-2 h-4 w-4" /> Live Arena
           </Button>
           <Button onClick={handleSave} disabled={isSaving || isCompleted}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-secondary/30 mb-8 p-1">
          <TabsTrigger value="general" className="data-[state=active]:bg-primary">General Info</TabsTrigger>
          <TabsTrigger value="categories" className="data-[state=active]:bg-primary">Categories</TabsTrigger>
          <TabsTrigger value="logistics" className="data-[state=active]:bg-primary">Logistics & Staff</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card className="bg-card/50 border-border">
            <CardHeader>
              <CardTitle>Core Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <Label>Tournament Name</Label>
                  <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} disabled={isCompleted} />
                </div>
                <div className="space-y-2">
                  <Label>Current Stage</Label>
                  <Select value={formData.status} onValueChange={val => setFormData({...formData, status: val})} disabled={isCompleted}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="registration">Registration</SelectItem>
                      <SelectItem value="active">Live</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Entry Fee (USD)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-emerald-500" />
                    <Input type="number" value={formData.entryFee} onChange={e => setFormData({...formData, entryFee: parseFloat(e.target.value) || 0})} className="pl-10 font-bold" disabled={isCompleted} />
                  </div>
                </div>
              </div>
              
              <div className="pt-6 border-t border-white/5 space-y-4">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <Shirt className="h-5 w-5 text-accent" />
                       <Label className="text-lg font-bold">Welcome Pack Options</Label>
                    </div>
                    <Switch checked={formData.hasWelcomePack} onCheckedChange={val => setFormData({...formData, hasWelcomePack: val})} disabled={isCompleted} />
                 </div>
                 {formData.hasWelcomePack && (
                   <div className="space-y-4 p-4 bg-white/5 rounded-xl border border-white/5">
                      <div className="space-y-2">
                        <Label>Pack Description</Label>
                        <Textarea value={formData.welcomePackDescription} onChange={e => setFormData({...formData, welcomePackDescription: e.target.value})} placeholder="e.g. Official T-Shirt and Gear" />
                      </div>
                      <div className="flex items-center justify-between">
                         <div className="text-sm">
                            <p className="font-bold">Require Size?</p>
                            <p className="text-[10px] text-muted-foreground">Capture size during player registration.</p>
                         </div>
                         <Switch checked={formData.requiresSize} onCheckedChange={val => setFormData({...formData, requiresSize: val})} disabled={isCompleted} />
                      </div>
                   </div>
                 )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">Brackets</h3>
            <Button size="sm" onClick={addCategory} disabled={!isDraft}><Plus className="w-4 h-4 mr-1" /> Add</Button>
          </div>
          <div className="grid gap-4">
            {formData.categories.map((cat) => (
              <Card key={cat.id} className="bg-card/30 border-dashed">
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-11 space-y-2">
                     <Label>Category: {cat.name}</Label>
                     <Input value={cat.name} onChange={e => updateCategory(cat.id, 'name', e.target.value)} disabled={!isDraft} />
                  </div>
                  <div className="md:col-span-1">
                    <Button variant="ghost" size="icon" onClick={() => removeCategory(cat.id)} disabled={!isDraft} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="logistics" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-card/50">
              <CardHeader><CardTitle>Locations</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input placeholder="Location name..." value={newLocName} onChange={e => setNewLocName(e.target.value)} />
                  <Input type="number" className="w-20" value={newLocCourts} onChange={e => setNewLocCourts(parseInt(e.target.value) || 1)} />
                  <Button onClick={addLocation}><Plus className="h-4 w-4" /></Button>
                </div>
                <div className="space-y-2">
                  {formData.locations.map((loc, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-secondary/30 rounded-lg">
                      <span className="text-sm font-bold">{loc.name} ({loc.numCourts} Courts)</span>
                      <Button variant="ghost" size="icon" onClick={() => removeLocation(i)} className="h-6 w-6 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
