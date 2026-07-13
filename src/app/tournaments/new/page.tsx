
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Trophy, Users, Layout, Zap, CheckCircle2, Loader2, Plus, Trash2, CalendarDays, Building2, MapPin, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { collection, addDoc, serverTimestamp, query, where, limit } from "firebase/firestore"
import { useFirestore, useUser, useMemoFirebase, useCollection, useUserClub, useFilteredCollection } from "@/firebase"
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

export default function TournamentWizard() {
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const router = useRouter()
  const db = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()

  // New Category State
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryFormat, setNewCategoryFormat] = useState("Single Elimination")
  const [newCategorySets, setNewCategorySets] = useState(3)
  const [newCategoryAge, setNewCategoryAge] = useState("Open")
  const [newCategoryIsTeam, setNewCategoryIsTeam] = useState(false)

  // Get current user's clubId (client-side filter workaround)
  const { club: userClub, clubId } = useUserClub()

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
    sport: "padel",
    numCourts: 1,
    locations: [] as string[],
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

  const handleLaunch = async () => {
    if (!db || !clubId) return
    setIsSubmitting(true)

    // CourtControl AI: firestore.rules'da allowedStatuses = ['draft', 'registration_open',
    // 'registration_closed', 'in_progress', 'completed', 'archived']. "active" yok,
    // eskiden yazım reddediliyordu. Yeni turnuva doğrudan kayıt açık.
    const tournamentData = {
      ...formData,
      clubId,
      status: "registration_open",
      createdAt: serverTimestamp()
    }

    try {
      const docRef = await addDoc(collection(db, "tournaments"), tournamentData)
      
      toast({
        title: "Tournament Launched!",
        description: `${formData.name} is now live and accepting registrations.`
      })
      
      router.push("/dashboard")
    } catch (e: any) {
      const error = new FirestorePermissionError({
        path: "tournaments",
        operation: "create",
        requestResourceData: tournamentData
      })
      errorEmitter.emit("permission-error", error)
      toast({
        variant: "destructive",
        title: "Launch Failed",
        description: "There was an error launching your tournament."
      })
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
          <p className="text-muted-foreground">Configure an event for <span className="text-primary font-bold">{userClub?.name}</span>.</p>
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
              <div className="space-y-2">
                <Label htmlFor="t-desc">Tournament Description</Label>
                <Textarea 
                  id="t-desc" 
                  placeholder="Describe your event, rules, and prizes..." 
                  className="bg-secondary/50 min-h-[100px]"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value, endDate: formData.endDate && formData.endDate < e.target.value ? e.target.value : formData.endDate })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-end-date">End Date <span className="text-muted-foreground text-[10px]">(multi-day)</span></Label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="t-end-date"
                      type="date"
                      className="bg-secondary/50 h-12 pl-10"
                      min={formData.startDate}
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
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
                      <SelectItem value="badminton">Badminton</SelectItem>
                      <SelectItem value="tennis">Tennis</SelectItem>
                      <SelectItem value="pickleball">Pickleball</SelectItem>
                      <SelectItem value="table-tennis">Table Tennis</SelectItem>
                      <SelectItem value="squash">Squash</SelectItem>
                      <SelectItem value="basketball">Basketball</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Multi-location support */}
              <div className="space-y-3 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" /> Venues / Locations
                    <span className="text-[10px] text-muted-foreground font-normal">
                      ({formData.locations.length} added, {formData.numCourts} courts total)
                    </span>
                  </Label>
                  <span className="text-[10px] text-muted-foreground italic">Multi-venue: matches consolidate across locations</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    id="t-location"
                    placeholder="e.g. Nicosia Central Court, Kyrenia Beach Club"
                    className="bg-secondary/30 h-11"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const target = e.target as HTMLInputElement
                        const value = target.value.trim()
                        if (value && !formData.locations.includes(value)) {
                          setFormData({ ...formData, locations: [...formData.locations, value] })
                          target.value = ''
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    onClick={(e) => {
                      const input = document.getElementById('t-location') as HTMLInputElement
                      const value = input.value.trim()
                      if (value && !formData.locations.includes(value)) {
                        setFormData({ ...formData, locations: [...formData.locations, value] })
                        input.value = ''
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
                {formData.locations.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.locations.map((loc, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="bg-primary/10 text-primary border-primary/20 px-3 py-1.5 text-xs flex items-center gap-2"
                      >
                        <MapPin className="h-3 w-3" />
                        {loc}
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, locations: formData.locations.filter((_, i) => i !== idx) })}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Total Courts</Label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={formData.numCourts}
                      onChange={(e) => setFormData({ ...formData, numCourts: parseInt(e.target.value) || 1 })}
                      className="bg-secondary/30 h-11"
                    />
                  </div>
                  {formData.startDate && formData.endDate && formData.endDate > formData.startDate && (
                    <div className="space-y-2">
                      <Label>Duration</Label>
                      <div className="bg-secondary/30 h-11 px-4 rounded-xl flex items-center text-sm text-accent font-bold">
                        {Math.ceil((new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days
                      </div>
                    </div>
                  )}
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
              <CardDescription>Define age groups, team types, and set rules.</CardDescription>
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
                              <span>Best of {category.sets} Sets</span>
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
                    <p className="text-muted-foreground max-w-xs">No categories added yet. Define at least one category to continue.</p>
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
                          <Label>Format</Label>
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
                            <span className="text-xs text-muted-foreground">Doubles or Team events</span>
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
                        <p className="text-xs text-muted-foreground mt-1">Includes standard tie-break rules for badminton and racquet sports.</p>
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
                  Next: Venue Logistics
                </Button>
              </div>
            </CardContent>
          </div>
        )}

        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <CardHeader className="bg-primary/10 py-8">
              <Building2 className="w-12 h-12 text-primary mb-4" />
              <CardTitle className="text-2xl font-headline">Step 3: Venue & Logistics</CardTitle>
              <CardDescription>Allocate resources for your tournament.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid gap-6">
                <div className="space-y-4">
                  <Label>Number of Allocated Courts</Label>
                  <div className="flex items-center gap-6 p-6 bg-secondary/30 rounded-2xl border border-border">
                    <div className="p-4 bg-primary/20 rounded-xl">
                      <MapPin className="h-8 w-8 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-lg">Court Allocation</p>
                      <p className="text-sm text-muted-foreground">Specify how many courts are available for this specific event.</p>
                    </div>
                    <div className="w-32">
                      <Input 
                        type="number" 
                        min="1" 
                        max={userClub?.numCourts || 100}
                        value={formData.numCourts}
                        onChange={(e) => setFormData({ ...formData, numCourts: parseInt(e.target.value) || 1 })}
                        className="h-12 text-center text-xl font-bold bg-background"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground italic">Your club has {userClub?.numCourts} courts available in total.</p>
                </div>

                <div className="flex items-center gap-4 p-5 border rounded-2xl bg-card">
                  <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center">
                    <Zap className="text-accent h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold">Telegram Notifications</h4>
                    <p className="text-sm text-muted-foreground">Players receive real-time court assignments.</p>
                  </div>
                  <Switch checked={true} disabled />
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
              Your {formData.sport} tournament <strong>{formData.name}</strong> is configured with {formData.categories.length} categories across {formData.numCourts} courts.
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
