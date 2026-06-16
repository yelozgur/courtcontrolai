
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trophy, Users, Layout, Zap, CheckCircle2 } from "lucide-react"

export default function TournamentWizard() {
  const [step, setStep] = useState(1)

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold">Tournament Wizard</h1>
          <p className="text-muted-foreground">Configure your event in 4 easy steps.</p>
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
                <Input id="t-name" placeholder="e.g. Summer Padel Series 2024" className="bg-secondary/50 h-12" />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="t-date">Start Date</Label>
                  <Input id="t-date" type="date" className="bg-secondary/50 h-12" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-sport">Sport Category</Label>
                  <Select>
                    <SelectTrigger className="bg-secondary/50 h-12">
                      <SelectValue placeholder="Select Sport" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="padel">Padel</SelectItem>
                      <SelectItem value="tennis">Tennis</SelectItem>
                      <SelectItem value="pickleball">Pickleball</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <Button onClick={() => setStep(2)} className="h-12 px-10">Next: Categories & Rules</Button>
              </div>
            </CardContent>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <CardHeader className="bg-accent/10 py-8">
              <Layout className="w-12 h-12 text-accent mb-4" />
              <CardTitle className="text-2xl font-headline text-accent">Step 2: Format & Categories</CardTitle>
              <CardDescription>Define how many winners you'll have and the rules they'll follow.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-secondary/30 border border-border rounded-xl">
                  <div>
                    <h4 className="font-bold">Pro Men's Singles</h4>
                    <p className="text-sm text-muted-foreground">Single Elimination • Set of 3</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-destructive">Remove</Button>
                </div>
                <Button variant="outline" className="w-full border-dashed border-2 py-8 h-auto">+ Add New Category</Button>
              </div>
              <div className="pt-4 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)} className="h-12">Back</Button>
                <Button onClick={() => setStep(3)} className="h-12 px-10">Next: Venue & Courts</Button>
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
                <div className="flex items-center gap-4 p-4 border rounded-xl">
                  <div className="w-10 h-10 bg-secondary rounded flex items-center justify-center">
                    <Zap className="text-accent h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold">Telegram Integration</h4>
                    <p className="text-sm text-muted-foreground">Automated match notifications and score verification.</p>
                  </div>
                  <Select defaultValue="on">
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="on">Enabled</SelectItem>
                      <SelectItem value="off">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Additional Data to Collect</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="justify-start">T-Shirt Sizes</Button>
                    <Button variant="outline" className="justify-start">Sponsor Preference</Button>
                    <Button variant="outline" className="justify-start">Food Allergies</Button>
                    <Button variant="outline" className="justify-start">Ranking History</Button>
                  </div>
                </div>
              </div>
              <div className="pt-4 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(2)} className="h-12">Back</Button>
                <Button onClick={() => setStep(4)} className="h-12 px-10">Preview & Launch</Button>
              </div>
            </CardContent>
          </div>
        )}

        {step === 4 && (
          <div className="animate-in fade-in zoom-in-95 duration-500 text-center py-20 px-8">
            <div className="w-24 h-24 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trophy className="w-12 h-12 text-accent" />
            </div>
            <h2 className="text-4xl font-headline font-bold mb-4">Ready for Launch!</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-10">
              Your tournament is configured and optimized. The OR-Tools Smart Scheduler is ready to build your brackets.
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="ghost" onClick={() => setStep(3)} className="h-12">Final Adjustments</Button>
              <Button className="h-12 px-10 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                Launch Tournament Live
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
