
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Trophy, Users, Layout, Zap, CheckCircle2, Loader2, Plus, Trash2, CalendarDays, Building2, MapPin, Clock, DollarSign } from "lucide-react"
import { collection, doc, setDoc, serverTimestamp, query, where, limit } from "firebase/firestore"
import { useFirestore, useUser, useMemoFirebase, useCollection } from "@/firebase"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

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

export default function TournamentWizard() {
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const router = useRouter()
  const db = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()

  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryFormat, setNewCategoryFormat] = useState("Single Elimination")
  const [newCategorySets, setNewCategorySets] = useState(3)
  const [newCategoryAge, setNewCategoryAge] = useState("Open")
  const [newCategoryIsTeam, setNewCategoryIsTeam] = useState(false)

  const [newLocationName, setNewLocationName] = useState("")
  const [newLocationCourts, setNewLocationCourts] = useState(1)

  const clubsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "clubs"), where("ownerId", "==", user.uid), limit(1))
  }, [db, user])

  const { data: userClubs } = useCollection(clubsQuery)
  const clubId = userClubs?.[0]?.id
  const clubSport = userClubs?.[0]?.primarySport || "padel"

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
    sport: "",
    matchDuration: 60,
    recoveryTime: 15,
    numCourts: 0,
    entryFee: 0,
    locations: [] as LocationEntry[],
    categories: [] as Category[]
  })

  useEffect(() => {
    if (clubSport && !formData.sport) {
      setFormData(prev => ({ ...prev, sport: clubSport }))
    }
  }, [clubSport, formData.sport])

  useEffect(() => {
    const total = formData.locations.reduce((acc, loc) => acc + loc.numCourts, 0);
    setFormData(prev => ({ ...prev, numCourts: total }));
  }, [formData.locations]);

  const handleAddCategory = () => {
    if (!newCategoryName) return
    const category: Category = {
      id: Math.random().toString(36).substr(2, 9),
      name: newCategoryName,
      format: newCategoryFormat,
      sets: newCategorySets,
      ageGroup: newCategoryAge,
      isTeamBased: newCategoryIsTeam
    }
    setFormData({
      ...formData,
      categories: [...formData.categories, category]
    })
    setNewCategoryName("")
    setNewCategoryAge("Open")
    setNewCategorySets(3)
    setNewCategoryIsTeam(false)
    setIsAddingCategory(false)
  }

  const removeCategory = (id: string) => {
    setFormData({
      ...formData,
      categories: formData.categories.filter(c => c.id !== id)
    })
  }

  const handleAddLocation = () => {
    if (!newLocationName) return
    setFormData({
      ...formData,
      locations: [...formData.locations, { name: newLocationName, numCourts: newLocationCourts }]
    })
    setNewLocationName("")
    setNewLocationCourts(1)
  }

  const removeLocation = (index: number) => {
    setFormData({
      ...formData,
      locations: formData.locations.filter((_, i) => i !== index)
    })
  }

  const handleLaunch = () => {
    if (!db || !clubId) return
    setIsSubmitting(true)
    
    const tournamentsCollection = collection(db, "tournaments")
    const tournamentRef = doc(tournamentsCollection)
    
    const tournamentData = {
      ...formData,
      clubId,
      status: "active",
      createdAt: serverTimestamp(),
      entryFee: Number(formData.entryFee) || 0
    }

    setDoc(tournamentRef, tournamentData)
      .then(() => {
         toast({ title: "Tournament Launched!" })
        router.push("/dashboard")
      })
      .catch(async (e) => {
        const error = new FirestorePermissionError({
          path: tournamentRef.path,
          operation: "create",
          requestResourceData: tournamentData
        })
        errorEmitter.emit("permission-error", error)
        setIsSubmitting(false)
      })
  }

  if (!clubId) return <div className="p-20 text-center"><Loader2 className="animate-spin h-10 w-10 mx-auto" /></div>

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold uppercase tracking-tighter">Tournament Wizard</h1>
          <p className="text-muted-foreground">Setup event identity and pricing.</p>
        </div>
      </div>

      <Card className="border-border bg-card shadow-xl overflow-hidden">
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <CardHeader className="bg-primary/10 py-8">
              <CardTitle className="text-2xl font-headline">Core Identity & Pricing</CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <Label>Tournament Name</Label>
                  <Input 
                    placeholder="e.g. Winter Open 2026" 
                    className="bg-secondary/50 h-12"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Entry Fee (USD)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-5 w-5 text-emerald-500" />
                    <Input 
                      type="number"
                      placeholder="0.00" 
                      className="bg-secondary/50 h-12 pl-10 text-xl font-bold"
                      value={formData.entryFee}
                      onChange={(e) => setFormData({ ...formData, entryFee: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Sport Category</Label>
                  <Select value={formData.sport} onValueChange={(val) => setFormData({ ...formData, sport: val })}>
                    <SelectTrigger className="bg-secondary/50 h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="padel">Padel</SelectItem>
                      <SelectItem value="tennis">Tennis</SelectItem>
                      <SelectItem value="badminton">Badminton</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" className="bg-secondary/50 h-12" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" className="bg-secondary/50 h-12" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} />
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <Button onClick={() => setStep(2)} className="h-12 px-10" disabled={!formData.name || !formData.startDate}>
                  Next: Categories
                </Button>
              </div>
            </CardContent>
          </div>
        )}
        
        {step === 2 && (
          <div className="p-8 space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
             <h2 className="text-2xl font-bold">Categories</h2>
             <div className="grid gap-4">
                {formData.categories.map(c => (
                  <div key={c.id} className="p-4 bg-secondary/30 rounded-xl flex justify-between items-center">
                    <div>
                       <p className="font-bold">{c.name}</p>
                       <p className="text-xs text-muted-foreground">{c.format} • {c.ageGroup}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeCategory(c.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" className="w-full border-dashed" onClick={() => setIsAddingCategory(true)}>Add Category</Button>
             </div>
             <Dialog open={isAddingCategory} onOpenChange={setIsAddingCategory}>
                <DialogContent>
                   <DialogHeader><DialogTitle>New Category</DialogTitle></DialogHeader>
                   <div className="space-y-4 py-4">
                      <Input placeholder="Category Name" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} />
                      <Select value={newCategoryFormat} onValueChange={setNewCategoryFormat}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Single Elimination">Single Elimination</SelectItem>
                          <SelectItem value="Round Robin">Round Robin</SelectItem>
                        </SelectContent>
                      </Select>
                   </div>
                   <DialogFooter>
                      <Button onClick={handleAddCategory}>Add</Button>
                   </DialogFooter>
                </DialogContent>
             </Dialog>
             <div className="pt-4 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                <Button onClick={() => setStep(3)} disabled={formData.categories.length === 0}>Next: Venue</Button>
             </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-8 space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
             <h2 className="text-2xl font-bold">Venue Logistics</h2>
             <div className="grid gap-4">
                <div className="flex gap-2">
                   <Input placeholder="Venue Name" value={newLocationName} onChange={e => setNewLocationName(e.target.value)} />
                   <Input type="number" className="w-24" value={newLocationCourts} onChange={e => setNewLocCourts(parseInt(e.target.value) || 1)} />
                   <Button onClick={handleAddLocation}><Plus className="h-4 w-4" /></Button>
                </div>
                {formData.locations.map((l, i) => (
                  <div key={i} className="p-4 bg-secondary/30 rounded-xl flex justify-between items-center">
                    <p className="font-bold">{l.name} • {l.numCourts} Courts</p>
                    <Button variant="ghost" size="icon" onClick={() => removeLocation(i)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
             </div>
             <div className="pt-4 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
                <Button onClick={() => setStep(4)} disabled={formData.locations.length === 0}>Finish</Button>
             </div>
          </div>
        )}

        {step === 4 && (
          <div className="p-12 text-center space-y-8">
             <Trophy className="h-20 w-20 text-primary mx-auto" />
             <h2 className="text-4xl font-bold uppercase">Ready to Collect?</h2>
             <p className="text-muted-foreground">Players will be charged <strong>${formData.entryFee}</strong> to join this tournament.</p>
             <div className="flex justify-center gap-4">
                <Button variant="ghost" onClick={() => setStep(3)}>Edit</Button>
                <Button size="lg" className="px-12" onClick={handleLaunch} disabled={isSubmitting}>
                   {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                   Launch Tournament
                </Button>
             </div>
          </div>
        )}
      </Card>
    </div>
  )
}
