
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
import { Trophy, Save, Loader2, ArrowLeft, Trash2, Plus, Layout, Lock, Unlock } from "lucide-react"
import { doc, updateDoc, deleteDoc } from "firebase/firestore"
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
    status: "",
    numCourts: 1,
    locations: [] as string[],
    categories: [] as any[]
  })
  
  const [isSaving, setIsSaving] = useState(false)
  const isLocked = tournament?.status !== "draft"

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
        categories: tournament.categories || []
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
        router.refresh()
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

  const addCategory = () => {
    const newCat = {
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

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-headline font-bold">Tournament Control</h1>
            <Badge variant={isLocked ? "secondary" : "outline"} className="mt-1">
              {isLocked ? <Lock className="w-3 h-3 mr-1" /> : <Unlock className="w-3 h-3 mr-1" />}
              {formData.status.toUpperCase()} STAGE
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" onClick={() => router.push(`/arena/${id}`)}>Live Arena</Button>
           <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-secondary/30">
          <TabsTrigger value="general">General Info</TabsTrigger>
          <TabsTrigger value="categories">Categories & Brackets</TabsTrigger>
          <TabsTrigger value="referees">Officials & Staff</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <Card className="bg-card/50 border-border">
            <CardHeader>
              <CardTitle>Core Details</CardTitle>
              <CardDescription>Status-based editing locks apply after registration opens.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2 col-span-2">
                  <Label>Tournament Name</Label>
                  <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Lifecycle Status</Label>
                  <Select value={formData.status} onValueChange={val => setFormData({...formData, status: val})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft (Editing Open)</SelectItem>
                      <SelectItem value="registration">Registration (Public Sign-up)</SelectItem>
                      <SelectItem value="active">Active (Live Scoring)</SelectItem>
                      <SelectItem value="completed">Completed (Read-only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Allocated Courts</Label>
                  <Input type="number" value={formData.numCourts} onChange={e => setFormData({...formData, numCourts: parseInt(e.target.value) || 1})} />
                </div>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Event Description</Label>
                <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="min-h-[120px]" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="mt-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">Competition Brackets</h3>
              <Button size="sm" onClick={addCategory} disabled={isLocked}>
                <Plus className="w-4 h-4 mr-1" /> Add Category
              </Button>
            </div>
            
            {formData.categories.map((cat) => (
              <Card key={cat.id} className="bg-card/30 border-dashed">
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Category Name</Label>
                    <Input value={cat.name} disabled={isLocked} onChange={e => updateCategory(cat.id, 'name', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Format</Label>
                    <Select value={cat.format} disabled={isLocked} onValueChange={v => updateCategory(cat.id, 'format', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Single Elimination">Single Elimination</SelectItem>
                        <SelectItem value="Round Robin">Round Robin</SelectItem>
                        <SelectItem value="Groups + Brackets">Groups + Brackets</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeCategory(cat.id)} disabled={isLocked} className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="referees" className="mt-6">
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle>Assigned Officials</CardTitle>
              <CardDescription>Referees added here will have access to the Officiating Console for this event.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Input placeholder="Enter referee email..." />
                <Button variant="secondary">Invite</Button>
              </div>
              <p className="text-sm text-muted-foreground italic">No officials assigned yet.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
