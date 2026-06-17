
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
import { Trophy, Save, Loader2, ArrowLeft, Trash2, Plus, Layout, Lock, Unlock, Users, Monitor, Gavel, AlertCircle } from "lucide-react"
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
    numCourts: 1,
    locations: [] as string[],
    categories: [] as Category[],
    referees: [] as string[]
  })
  
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [newRefereeEmail, setNewRefereeEmail] = useState("")
  const [newLocInput, setNewLocInput] = useState("")

  // Stage logic
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
        numCourts: tournament.numCourts || 1,
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
      numCourts: Number(formData.numCourts) || 1
    }

    updateDoc(docRef, updateData)
      .then(() => {
        toast({ title: "Tournament Updated", description: "All changes have been synced." })
      })
      .catch(async (e) => {
        const error = new FirestorePermissionError({
          path: docRef.path,
          operation: "update",
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
    if (!newLocInput) return
    if (!formData.locations.includes(newLocInput)) {
      setFormData({ ...formData, locations: [...formData.locations, newLocInput] })
    }
    setNewLocInput("")
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
              {isOperational && <Badge className="bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20">OPERATIONAL</Badge>}
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
          {isDraft && (
            <Button variant="destructive" size="icon" onClick={handleDelete} disabled={isDeleting}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {!isDraft && (
        <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl flex items-start gap-4">
          <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-primary">Registration/Live Mode Active</p>
            <p className="text-muted-foreground">Structural fields (Sport, Categories) are locked to maintain competition integrity. Logistics (Courts, Venues, Staff) remain flexible.</p>
          </div>
        </div>
      )}

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
              <CardDescription>Basic settings for the event.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <Label>Tournament Name</Label>
                  <Input 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    disabled={isCompleted}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Current Stage</Label>
                  <Select value={formData.status} onValueChange={val => setFormData({...formData, status: val})} disabled={isCompleted}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft (Planning)</SelectItem>
                      <SelectItem value="registration">Registration (Accepting Players)</SelectItem>
                      <SelectItem value="active">Live (Scoring & Matches)</SelectItem>
                      <SelectItem value="completed">Completed (Archives)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tournament Sport</Label>
                  <Input 
                    value={formData.sport} 
                    disabled={!isDraft} 
                    onChange={e => setFormData({...formData, sport: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} disabled={isCompleted} />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} disabled={isCompleted} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Event Description</Label>
                <Textarea 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
                  className="min-h-[120px]"
                  disabled={isCompleted}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold">Competition Brackets</h3>
              <p className="text-sm text-muted-foreground">Manage your player categories.</p>
            </div>
            <Button size="sm" onClick={addCategory} disabled={!isDraft}>
              <Plus className="w-4 h-4 mr-1" /> New Category
            </Button>
          </div>
          
          <div className="grid gap-4">
            {formData.categories.map((cat) => (
              <Card key={cat.id} className="bg-card/30 border-dashed">
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="space-y-2 md:col-span-4">
                    <Label>Category Name</Label>
                    <Input value={cat.name} disabled={!isDraft} onChange={e => updateCategory(cat.id, 'name', e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <Label>Format</Label>
                    <Select value={cat.format} disabled={!isDraft} onValueChange={v => updateCategory(cat.id, 'format', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Single Elimination">Single Elimination</SelectItem>
                        <SelectItem value="Round Robin">Round Robin</SelectItem>
                        <SelectItem value="Groups + Brackets">Groups + Brackets</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Age Group</Label>
                    <Input value={cat.ageGroup} disabled={!isDraft} onChange={e => updateCategory(cat.id, 'ageGroup', e.target.value)} />
                  </div>
                  <div className="flex items-center justify-center space-y-2 md:col-span-2 pb-2">
                    <div className="flex flex-col items-center gap-1">
                      <Label className="text-[10px] uppercase">Teams?</Label>
                      <Switch 
                        checked={cat.isTeamBased} 
                        onCheckedChange={(val) => updateCategory(cat.id, 'isTeamBased', val)}
                        disabled={!isDraft}
                      />
                    </div>
                  </div>
                  <div className="md:col-span-1 flex justify-end">
                    <Button variant="ghost" size="icon" onClick={() => removeCategory(cat.id)} disabled={!isDraft} className="text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {formData.categories.length === 0 && (
              <div className="text-center py-12 bg-white/5 rounded-2xl border-dashed border-2 border-white/5">
                <Layout className="h-10 w-10 text-muted-foreground mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">No categories defined yet.</p>
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="logistics" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5 text-primary" />
                  Venue Allocation
                </CardTitle>
                <CardDescription>Allocate courts and map your locations.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Concurrent Courts</Label>
                  <Input 
                    type="number" 
                    value={formData.numCourts} 
                    onChange={e => setFormData({...formData, numCourts: parseInt(e.target.value) || 1})}
                    disabled={isCompleted}
                  />
                  <p className="text-xs text-muted-foreground italic">Scaling courts is allowed during active stages.</p>
                </div>

                <div className="space-y-4">
                  <Label>Venue Locations</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="e.g. Center Court, Hall A" 
                      className="flex-1"
                      value={newLocInput}
                      onChange={(e) => setNewLocInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          addLocation();
                        }
                      }}
                    />
                    <Button variant="secondary" onClick={addLocation}><Plus className="h-4 w-4" /></Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.locations.map((loc, i) => (
                      <Badge key={i} variant="secondary" className="px-3 py-1 gap-2">
                        {loc}
                        <Trash2 className="h-3 w-3 cursor-pointer text-destructive" onClick={() => setFormData({...formData, locations: formData.locations.filter((_, idx) => idx !== i)})} />
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gavel className="h-5 w-5 text-accent" />
                  Tournament Staff
                </CardTitle>
                <CardDescription>Assign officials who can score matches live.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Add Referee (Email)</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="email"
                      placeholder="referee@example.com"
                      value={newRefereeEmail}
                      onChange={e => setNewRefereeEmail(e.target.value)}
                    />
                    <Button variant="secondary" onClick={addReferee}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Official Roster</Label>
                  <div className="space-y-2">
                    {formData.referees.map((refEmail, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-secondary/30 rounded-lg border border-border">
                        <span className="text-sm font-medium">{refEmail}</span>
                        <Button variant="ghost" size="icon" onClick={() => setFormData({...formData, referees: formData.referees.filter(r => r !== refEmail)})} className="h-6 w-6 text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    {formData.referees.length === 0 && (
                      <p className="text-xs text-muted-foreground italic text-center py-4">No officials assigned yet.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
