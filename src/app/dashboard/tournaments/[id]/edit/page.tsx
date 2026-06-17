
"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Trophy, Layout, Save, Loader2, ArrowLeft, Trash2 } from "lucide-react"
import { doc, updateDoc, deleteDoc } from "firebase/firestore"
import { useFirestore, useDoc } from "@/firebase"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { useToast } from "@/hooks/use-toast"

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
    numCourts: 1
  })
  
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (tournament) {
      setFormData({
        name: tournament.name || "",
        description: tournament.description || "",
        startDate: tournament.startDate || "",
        endDate: tournament.endDate || "",
        sport: tournament.sport || "padel",
        status: tournament.status || "active",
        numCourts: tournament.numCourts || 1
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
        toast({ title: "Tournament Updated", description: "Changes have been saved successfully." })
        router.push("/dashboard")
      })
      .catch(async (e) => {
        const error = new FirestorePermissionError({
          path: docRef.path,
          operation: "update",
          requestResourceData: updateData
        })
        errorEmitter.emit("permission-error", error)
        setIsSaving(false)
      })
  }

  const handleDelete = async () => {
    if (!db || !id) return
    if (!confirm("Are you sure you want to delete this tournament? This action is irreversible.")) return
    
    const docRef = doc(db, "tournaments", id as string)
    deleteDoc(docRef)
      .then(() => {
        toast({ title: "Tournament Deleted" })
        router.push("/dashboard")
      })
      .catch(async (e) => {
        const error = new FirestorePermissionError({
          path: docRef.path,
          operation: "delete"
        })
        errorEmitter.emit("permission-error", error)
      })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="text-center py-20">
        <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
        <h2 className="text-2xl font-bold">Tournament Not Found</h2>
        <Button onClick={() => router.push("/dashboard")} className="mt-4">Back to Dashboard</Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-headline font-bold">Manage Tournament</h1>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          <Trash2 className="mr-2 h-4 w-4" /> Delete Event
        </Button>
      </div>

      <Card className="bg-card/50 border-border shadow-xl">
        <CardHeader>
          <CardTitle>Event Settings</CardTitle>
          <CardDescription>Update basic information and status for {tournament.name}.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Tournament Name</Label>
            <Input 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sport</Label>
              <Select value={formData.sport} onValueChange={val => setFormData({...formData, sport: val})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="padel">Padel</SelectItem>
                  <SelectItem value="tennis">Tennis</SelectItem>
                  <SelectItem value="badminton">Badminton</SelectItem>
                  <SelectItem value="pickleball">Pickleball</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={val => setFormData({...formData, status: val})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active (Publicly Visible)</SelectItem>
                  <SelectItem value="finished">Finished</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input 
                type="date"
                value={formData.startDate} 
                onChange={e => setFormData({...formData, startDate: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input 
                type="date"
                value={formData.endDate} 
                onChange={e => setFormData({...formData, endDate: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Allocated Courts</Label>
            <Input 
              type="number"
              value={formData.numCourts} 
              onChange={e => setFormData({...formData, numCourts: parseInt(e.target.value) || 1})}
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea 
              className="min-h-[100px]"
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <Button className="w-full h-12 text-lg font-bold" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function useMemoFirebase<T>(factory: () => T, deps: any[]): T {
  return React.useMemo(factory, deps)
}
import React from "react"
