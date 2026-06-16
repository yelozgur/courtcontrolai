
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Trophy, Users, Layout, Zap, CheckCircle2, Loader2, Plus, Trash2, CalendarDays } from "lucide-react"
import { collection, addDoc, serverTimestamp, query, where, limit } from "firebase/firestore"
import { useFirestore, useUser, useMemoFirebase, useCollection } from "@/firebase"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
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

export default function TournamentWizard() {
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const router = useRouter()
  const db = useFirestore()
  const { user } = useUser()

  // New Category State
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryFormat, setNewCategoryFormat] = useState("Single Elimination")
  const [newCategorySets, setNewCategorySets] = useState(3)
  const [newCategoryAge, setNewCategoryAge] = useState("Open")
  const [newCategoryIsTeam, setNewCategoryIsTeam] = useState(false)

  // Get current user's clubId
  const clubsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "clubs"), where("ownerId", "==", user.uid), limit(1))
  }, [db, user])

  const { data: userClubs } = useCollection(clubsQuery)
  const clubId = userClubs?.[0]?.id

  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    sport: "padel",
    categories: [] as Category[]
  })

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
    setNewCategoryIsTeam(false)
    setIsAddingCategory(false)
  }

  const removeCategory = (id: string) => {
    setFormData({
      ...formData,
      categories: formData.categories.filter(c => c.id !== id)
    })
  }

  const handleLaunch = async () => {
    if (!db || !clubId) return
    setIsSubmitting(true)
    
    const tournamentData = {
      ...formData,
      clubId,
      status: "active",
      createdAt: serverTimestamp()
    }

    try {
      const docRef = await addDoc(collection(db, "tournaments"), tournamentData)
      
      // Seed a live match for the first category if any exist
      if (formData.categories.length > 0) {
        await addDoc(collection(db, "matches"), {
          clubId,
          tournamentId: docRef.id,
          court: 1,
          category: formData.categories[0].name,
          teamA: { name: "Team A", score: 0, players: ["P1"] },
          teamB: { name: "Team B", score: 0, players: ["P2"] },
          status: "live",
          startTime: serverTimestamp(),
          durationMinutes: 0
        })
      }
      
      router.push("/dashboard")
    } catch (e: any) {
      const error = new FirestorePermissionError({
        path: "tournaments",
        operation: "create",
        requestResourceData: tournamentData
      })
      errorEmitter.emit("permission-error", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!clubId) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="animate-spin h-10 w-10 text-primary" />
        <p className="text-muted-foreground animate-pulse">Loading club data...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold">Tournament Wizard</h1>
          <p className="text-muted-foreground">Configure an event for <span className="text-primary font-bold">{userClubs?.[0]?.name}</span>.</p>
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div 
              key={s} 
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
                step === s ? "bg-primary text-primary-foreground scale-110 shadow-lg" : 
                step > s ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              {step > s ? <CheckCircle2 className="w-6 h-6" /> : s}
            </div>
          ))}
        </div>
      </div>

      <Card className="border-border bg-card shadow-xl overflow-hidden">
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <CardHeader className="bg-primary/10 py-8">
              <Trophy className="w-12 h-12 text-primary mb-4" />
              <CardTitle className="text-2xl font-headline">Step 1: Core Identity</CardTitle>
              <CardDescription>Tell us the basics of your epic tournament.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="t-name">Tournament Name</Label>
                <Input 
                  id="t-name" 
                  placeholder="e.g. Summer Padel Series 2024" 
                  className="bg-secondary/50 h-12 text-lg"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="t-date">Start Date</Label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                    <Input 
                      id="t-date" 
                      type="date" 
                      className="bg-secondary/50 h-12 pl-10" 
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-sport">Sport Category</Label>
                  <Select value={formData.sport} onValueChange={(val) => setFormData({ ...formData, sport: val })}>
                    <SelectTrigger className="bg-secondary/50 h-12">
                      <SelectValue placeholder="Select Sport" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="padel">Padel</SelectItem>
                      <SelectItem value="tennis">Tennis</SelectItem>
                      <SelectItem value="pickleball">Pickleball</SelectItem>
                      <SelectItem value="basketball">Basketball</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <Button onClick={() => setStep(2)} className="h-12 px-10" disabled={!formData.name || !formData.startDate}>
                  Next: Categories & Rules
                </Button>
              </div>
            </CardContent>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <CardHeader className="bg-accent/10 py-8">
              <Layout className="w-12 h-12 text-accent mb-4" />
              <CardTitle className="text-2xl font-headline text-accent">Step 2: Format & Categories</CardTitle>
              <CardDescription>Define age groups and whether it's an individual or team competition.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-4">
                {formData.categories.length > 0 ? (
                  <div className="grid gap-4">
                    {formData.categories.map((category) => (
                      <div key={category.id} className="flex items-center justify-between p-5 bg-secondary/30 border border-border rounded-2xl group transition-all hover:border-accent/40">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl ${category.isTeamBased ? 'bg-primary/20 text-primary' : 'bg-accent/20 text-accent'}`}>
                            {category.isTeamBased ? <Users className="h-5 w-5" /> : <Trophy className="h-5 w-5" />}
                          </div>
                          <div>
                            <h4 className="font-bold text-lg">{category.name}</h4>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span className="font-medium text-accent">{category.ageGroup}</span>
                              <span>•</span>
                              <span>{category.format}</span>
                              <span>•</span>
                              <span>Best of {category.sets}</span>
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeCategory(category.id)} className="text-destructive opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-16 text-center border-2 border-dashed rounded-2xl bg-secondary/10 flex flex-col items-center gap-4">
                    <Layout className="h-12 w-12 text-muted-foreground/30" />
                    <p className="text-muted-foreground max-w-xs">No categories added yet. Define at least one category to continue with the tournament launch.</p>
                  </div>
                )}

                <Dialog open={isAddingCategory} onOpenChange={setIsAddingCategory}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full border-dashed border-2 py-8 h-auto hover:bg-accent/5 hover:border-accent/40">
                      <Plus className="mr-2 h-5 w-5" /> Add New Competition Category
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Competition Category Configuration</DialogTitle>
                      <DialogDescription>
                        Set rules for age, teams, and match formats.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5 py-4">
                      <div className="space-y-2">
                        <Label>Category Name</Label>
                        <Input 
                          placeholder="e.g. Pro Men's Singles" 
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          className="h-11"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Age Group</Label>
                          <Select value={newCategoryAge} onValueChange={setNewCategoryAge}>
                            <SelectTrigger className="h-11">
                              <SelectValue />
                            </SelectTrigger>
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
                        <div className="space-y-2">
                          <Label>Competition Format</Label>
                          <Select value={newCategoryFormat} onValueChange={setNewCategoryFormat}>
                            <SelectTrigger className="h-11">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Single Elimination">Single Elimination</SelectItem>
                              <SelectItem value="Double Elimination">Double Elimination</SelectItem>
                              <SelectItem value="Round Robin">Round Robin</SelectItem>
                              <SelectItem value="Groups + Brackets">Groups + Brackets</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl">
                        <div className="flex items-center gap-3">
                          <Users className="h-5 w-5 text-primary" />
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">Team-Based Entry</span>
                            <span className="text-xs text-muted-foreground">Toggle for Doubles or Team events</span>
                          </div>
                        </div>
                        <Switch 
                          checked={newCategoryIsTeam} 
                          onCheckedChange={setNewCategoryIsTeam} 
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Sets per Match (Best of)</Label>
                        <div className="flex gap-2">
                          {[1, 3, 5].map((s) => (
                            <Button 
                              key={s}
                              type="button"
                              variant={newCategorySets === s ? "default" : "outline"}
                              className="flex-1 h-11"
                              onClick={() => setNewCategorySets(s)}
                            >
                              {s} Sets
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setIsAddingCategory(false)} className="h-11">Cancel</Button>
                      <Button onClick={handleAddCategory} disabled={!newCategoryName} className="h-11 px-8">Add Category</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="pt-4 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)} className="h-12 px-8">Back</Button>
                <Button onClick={() => setStep(3)} className="h-12 px-10" disabled={formData.categories.length === 0}>
                  Next: Participant Engine
                </Button>
              </div>
            </CardContent>
          </div>
        )}

        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <CardHeader className="bg-primary/10 py-8">
              <Users className="w-12 h-12 text-primary mb-4" />
              <CardTitle className="text-2xl font-headline">Step 3: Participant Engine</CardTitle>
              <CardDescription>Configure registration fields and preference collection.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-5 border rounded-2xl bg-card">
                  <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center">
                    <Zap className="text-accent h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold">Telegram Automation</h4>
                    <p className="text-sm text-muted-foreground">Players receive match court assignments and final score prompts via Telegram.</p>
                  </div>
                  <Select defaultValue="on">
                    <SelectTrigger className="w-36 h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="on">Smart Sync ON</SelectItem>
                      <SelectItem value="off">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="pt-4 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(2)} className="h-12 px-8">Back</Button>
                <Button onClick={() => setStep(4)} className="h-12 px-10">Preview & Launch</Button>
              </div>
            </CardContent>
          </div>
        )}

        {step === 4 && (
          <div className="animate-in fade-in zoom-in-95 duration-500 text-center py-24 px-8">
            <div className="w-28 h-28 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
              <Trophy className="w-14 h-14 text-accent drop-shadow-lg" />
            </div>
            <h2 className="text-5xl font-headline font-bold mb-4 tracking-tighter">Ready for Launch!</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-12 text-lg">
              Your tournament is configured for <span className="text-primary font-bold">{userClubs?.[0]?.name}</span>. The OR-Tools engine is ready to compute the bracket.
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="ghost" onClick={() => setStep(3)} className="h-12" disabled={isSubmitting}>
                Final Adjustments
              </Button>
              <Button 
                className="h-12 px-12 bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 text-lg font-bold"
                onClick={handleLaunch}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Launch Tournament Live
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
