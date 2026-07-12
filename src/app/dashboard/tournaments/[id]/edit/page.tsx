"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Save, Loader2, ArrowLeft, Plus, MapPin, X } from "lucide-react"
import { doc, updateDoc } from "firebase/firestore"
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { COMPREHENSIVE_SPORTS } from "@/lib/sports"

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

  const isDraft = formData.status === "draft"
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

  const handleSave = () => {
    if (!db || !id) return
    setIsSaving(true)
    
    const docRef = doc(db, "tournaments", id as string)
    const updateData = {
      ...formData,
      entryFee: Number(formData.entryFee) || 0,
      numCourts: Number(formData.numCourts) || 0,
      version: (tournament?.version || 1) + 1
    }

    updateDoc(docRef, updateData)
      .then(() => {
        toast({ title: "Tournament Updated" })
      })
      .catch(async () => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: updateData
        }))
      })
      .finally(() => setIsSaving(false))
  }

  // Category dialog state
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [newCatName, setNewCatName] = useState("")
  const [newCatFormat, setNewCatFormat] = useState("Single Elimination")
  const [newCatSets, setNewCatSets] = useState(3)
  const [newCatAge, setNewCatAge] = useState("Open")
  const [newCatIsTeam, setNewCatIsTeam] = useState(false)

  const openCategoryDialog = () => {
    setNewCatName("")
    setNewCatFormat("Single Elimination")
    setNewCatSets(3)
    setNewCatAge("Open")
    setNewCatIsTeam(false)
    setIsAddingCategory(true)
  }

  const confirmAddCategory = () => {
    if (!newCatName.trim()) return
    const newCat: Category = {
      id: Math.random().toString(36).substr(2, 9),
      name: newCatName.trim(),
      format: newCatFormat,
      sets: newCatSets,
      ageGroup: newCatAge,
      isTeamBased: newCatIsTeam
    }
    setFormData({ ...formData, categories: [...formData.categories, newCat] })
    setIsAddingCategory(false)
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
            <Badge variant={isDraft ? "outline" : "secondary"}>
              {formData.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving || isCompleted}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-secondary/30 mb-8 p-1">
          <TabsTrigger value="general">General Info</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="logistics">Logistics</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card className="bg-card/50 border-border">
            <CardHeader><CardTitle>Core Details</CardTitle></CardHeader>
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
                      <SelectItem value="registration_open">Registration Open</SelectItem>
                      <SelectItem value="registration_closed">Registration Closed</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sport Category</Label>
                  <Select value={formData.sport} onValueChange={val => setFormData({...formData, sport: val})} disabled={isCompleted}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COMPREHENSIVE_SPORTS.map(sport => (
                        <SelectItem key={sport.value} value={sport.value}>{sport.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="categories" className="space-y-6">
           <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">Competition Brackets</h3>
              <Dialog open={isAddingCategory} onOpenChange={setIsAddingCategory}>
                <DialogTrigger asChild>
                  <Button onClick={openCategoryDialog} disabled={!isDraft} size="sm">
                    <Plus className="h-4 w-4 mr-2" /> Add Category
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Category</DialogTitle>
                    <DialogDescription>Define a new competition bracket. You can edit details later.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Category Name</Label>
                      <Input
                        placeholder="e.g. Pro Men's Singles, Mixed Doubles"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Format</Label>
                        <Select value={newCatFormat} onValueChange={setNewCatFormat}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Single Elimination">Single Elimination</SelectItem>
                            <SelectItem value="Double Elimination">Double Elimination</SelectItem>
                            <SelectItem value="Round Robin">Round Robin</SelectItem>
                            <SelectItem value="Swiss">Swiss</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Sets</Label>
                        <Select value={newCatSets.toString()} onValueChange={(v) => setNewCatSets(parseInt(v))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Best of 1</SelectItem>
                            <SelectItem value="3">Best of 3</SelectItem>
                            <SelectItem value="5">Best of 5</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Age Group</Label>
                      <Select value={newCatAge} onValueChange={setNewCatAge}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Open">Open (All Ages)</SelectItem>
                          <SelectItem value="Junior (U12)">Junior (U12)</SelectItem>
                          <SelectItem value="Junior (U16)">Junior (U16)</SelectItem>
                          <SelectItem value="Junior (U18)">Junior (U18)</SelectItem>
                          <SelectItem value="Senior (35+)">Senior (35+)</SelectItem>
                          <SelectItem value="Senior (45+)">Senior (45+)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-secondary/30 rounded-xl">
                      <input
                        type="checkbox"
                        id="is-team-based"
                        checked={newCatIsTeam}
                        onChange={(e) => setNewCatIsTeam(e.target.checked)}
                        className="h-4 w-4 rounded border-white/20"
                      />
                      <Label htmlFor="is-team-based" className="text-xs font-medium cursor-pointer">
                        Team-based (doubles/mixed doubles — players register as teams)
                      </Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddingCategory(false)}>Cancel</Button>
                    <Button onClick={confirmAddCategory} disabled={!newCatName.trim()}>Add Category</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
           </div>
           <div className="grid gap-4">
              {formData.categories.map(c => (
                <Card key={c.id} className="p-4 bg-secondary/20">
                  <Input value={c.name} onChange={e => setFormData({...formData, categories: formData.categories.map(cat => cat.id === c.id ? {...cat, name: e.target.value} : cat)})} disabled={!isDraft} />
                </Card>
              ))}
           </div>
        </TabsContent>

        <TabsContent value="logistics" className="space-y-6">
           <Card className="bg-card/50 border-border">
              <CardHeader><CardTitle>Venue Allocation</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                 <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex items-center gap-4">
                    <MapPin className="h-6 w-6 text-primary" />
                    <div>
                       <p className="font-bold">Resource Management</p>
                       <p className="text-xs text-muted-foreground">Adjust match timing and buffer logic for Genkit optimizer.</p>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <Label>Match Duration (Min)</Label>
                       <Input type="number" value={formData.matchDuration} onChange={e => setFormData({...formData, matchDuration: parseInt(e.target.value) || 60})} />
                    </div>
                    <div className="space-y-2">
                       <Label>Recovery Buffer (Min)</Label>
                       <Input type="number" value={formData.recoveryTime} onChange={e => setFormData({...formData, recoveryTime: parseInt(e.target.value) || 15})} />
                    </div>
                 </div>
              </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
