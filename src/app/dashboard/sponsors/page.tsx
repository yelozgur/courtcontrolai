"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { 
  Heart, 
  Plus, 
  ExternalLink,
  Trash2,
  Loader2,
  Trophy,
  Building
} from "lucide-react"
import { collection, addDoc, deleteDoc, doc, query, where, limit } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection, useUser, useUserClub, useFilteredCollection } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { cn } from "@/lib/utils"

export default function SponsorManagement() {
  const db = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()
  
  // Get current user's clubId
  // Club resolution (client-side filter workaround)
  const { clubId } = useUserClub()

  // Get tournaments for sponsorship context (client-side filter)
  const { data: tournaments } = useFilteredCollection<any>(
    "tournaments",
    clubId ? (t: any) => t.clubId === clubId : undefined,
    { deps: [clubId] }
  )

  const [isAdding, setIsAdding] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    websiteUrl: "",
    tier: "bronze",
    tournamentId: "club" // Default to club-wide
  })

  // Sponsors (client-side filter)
  const { data: sponsors, loading } = useFilteredCollection<any>(
    "sponsors",
    clubId ? (s: any) => s.clubId === clubId : undefined,
    { deps: [clubId] }
  )

  const handleAddSponsor = () => {
    if (!db || !clubId || !formData.name) return
    setIsAdding(true)
    
    const sponsorData = {
      name: formData.name,
      websiteUrl: formData.websiteUrl,
      tier: formData.tier,
      clubId,
      tournamentId: formData.tournamentId === "club" ? null : formData.tournamentId,
      logoUrl: `https://picsum.photos/seed/${formData.name}/200/100`
    }

    // Use non-blocking mutation pattern
    addDoc(collection(db, "sponsors"), sponsorData)
      .then(() => {
        setFormData({ name: "", websiteUrl: "", tier: "bronze", tournamentId: "club" })
        toast({ title: "Partner Registered", description: `${formData.name} is now a partner.` })
      })
      .catch(async (e) => {
        const error = new FirestorePermissionError({
          path: "sponsors",
          operation: "create",
          requestResourceData: sponsorData
        });
        errorEmitter.emit('permission-error', error);
      })
      .finally(() => {
        setIsAdding(false)
      })
  }

  const handleDeleteSponsor = (id: string) => {
    if (!db) return
    const sponsorRef = doc(db, "sponsors", id);
    
    // Non-blocking delete
    deleteDoc(sponsorRef)
      .then(() => {
        toast({ title: "Partner Removed" })
      })
      .catch(async (e) => {
        const error = new FirestorePermissionError({
          path: sponsorRef.path,
          operation: "delete"
        });
        errorEmitter.emit('permission-error', error);
      });
  }

  if (!clubId && !loading) return <div className="p-8">No club found. Please register your club first.</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-white uppercase tracking-tighter">Partners & Sponsors</h1>
          <p className="text-muted-foreground">Manage the brands supporting your sports community.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 bg-card/50 border-border h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Add Partner
            </CardTitle>
            <CardDescription>Register a brand for club-wide or event-specific support.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Brand Name</Label>
              <Input 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="Brand Name"
                className="bg-secondary/30 border-white/5"
              />
            </div>
            <div className="space-y-2">
              <Label>Website URL</Label>
              <Input 
                value={formData.websiteUrl} 
                onChange={e => setFormData({...formData, websiteUrl: e.target.value})}
                placeholder="https://brand.com"
                className="bg-secondary/30 border-white/5"
              />
            </div>
            <div className="space-y-2">
              <Label>Sponsorship Scope</Label>
              <Select value={formData.tournamentId} onValueChange={val => setFormData({...formData, tournamentId: val})}>
                <SelectTrigger className="bg-secondary/30 border-white/5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="club">
                    <div className="flex items-center gap-2"><Building className="h-3 w-3" /> Club-wide</div>
                  </SelectItem>
                  {tournaments?.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex items-center gap-2"><Trophy className="h-3 w-3" /> Event: {t.name}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Partner Tier</Label>
              <Select value={formData.tier} onValueChange={val => setFormData({...formData, tier: val})}>
                <SelectTrigger className="bg-secondary/30 border-white/5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gold">Gold Partner</SelectItem>
                  <SelectItem value="silver">Silver Partner</SelectItem>
                  <SelectItem value="bronze">Bronze Sponsor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full mt-2" onClick={handleAddSponsor} disabled={isAdding || !formData.name}>
              {isAdding ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              Register Partner
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 bg-card/50 border-border">
          <CardHeader>
            <CardTitle>Partner Registry</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
            ) : sponsors && sponsors.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableHead className="uppercase text-[10px] font-bold tracking-widest text-muted-foreground">Partner</TableHead>
                    <TableHead className="uppercase text-[10px] font-bold tracking-widest text-muted-foreground">Scope</TableHead>
                    <TableHead className="uppercase text-[10px] font-bold tracking-widest text-muted-foreground">Tier</TableHead>
                    <TableHead className="text-right pr-6 uppercase text-[10px] font-bold tracking-widest text-muted-foreground">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sponsors.map((s) => (
                    <TableRow key={s.id} className="border-white/5 hover:bg-white/5 transition-colors">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-white">{s.name}</span>
                          {s.websiteUrl && (
                            <a href={s.websiteUrl} target="_blank" className="text-[10px] text-primary hover:underline flex items-center gap-1 mt-0.5">
                              <ExternalLink className="h-2.5 w-2.5" /> Visit
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {s.tournamentId ? (
                          <div className="flex items-center gap-1 text-[10px] text-accent font-bold uppercase">
                            <Trophy className="h-3 w-3" /> {tournaments?.find(t => t.id === s.tournamentId)?.name || 'Event'}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-bold uppercase">
                            <Building className="h-3 w-3" /> Club-wide
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          "text-[10px] uppercase font-bold",
                          s.tier === "gold" ? "border-amber-400 text-amber-400" :
                          s.tier === "silver" ? "border-slate-300 text-slate-300" :
                          "border-orange-400 text-orange-400"
                        )}>
                          {s.tier}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteSponsor(s.id)} className="h-8 w-8 hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-20 text-muted-foreground italic flex flex-col items-center gap-4">
                <Heart className="h-12 w-12 opacity-10" />
                <p>No active partnerships registered yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}