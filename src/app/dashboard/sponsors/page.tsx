
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  Loader2
} from "lucide-react"
import { collection, addDoc, deleteDoc, doc, query, where, limit } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection, useUser } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function SponsorManagement() {
  const db = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()
  
  // Get current user's clubId
  const clubsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "clubs"), where("ownerId", "==", user.uid), limit(1))
  }, [db, user])

  const { data: userClubs } = useCollection(clubsQuery)
  const clubId = userClubs?.[0]?.id

  const [isAdding, setIsAdding] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    websiteUrl: "",
    tier: "bronze"
  })

  const sponsorsQuery = useMemoFirebase(() => {
    if (!db || !clubId) return null
    return query(collection(db, "sponsors"), where("clubId", "==", clubId), limit(50))
  }, [db, clubId])

  const { data: sponsors, loading } = useCollection(sponsorsQuery)

  const handleAddSponsor = async () => {
    if (!db || !clubId || !formData.name) return
    setIsAdding(true)
    try {
      await addDoc(collection(db, "sponsors"), {
        ...formData,
        clubId,
        logoUrl: `https://picsum.photos/seed/${formData.name}/200/100`
      })
      setFormData({ name: "", websiteUrl: "", tier: "bronze" })
      toast({ title: "Partner Added", description: `${formData.name} is now a partner.` })
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Could not add sponsor." })
    } finally {
      setIsAdding(false)
    }
  }

  const handleDeleteSponsor = async (id: string) => {
    if (!db) return
    try {
      await deleteDoc(doc(db, "sponsors", id))
      toast({ title: "Partner Removed" })
    } catch (e) {
      toast({ variant: "destructive", title: "Error" })
    }
  }

  if (!clubId && !loading) return <div className="p-8">No club found. Please register your club first.</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Partners & Sponsors</h1>
          <p className="text-muted-foreground">Manage the brands supporting <span className="text-primary font-bold">{userClubs?.[0]?.name}</span>.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 bg-card/50 border-border h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Add New Partner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Brand Name</Label>
              <Input 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="Brand Name"
              />
            </div>
            <div className="space-y-2">
              <Label>Website URL</Label>
              <Input 
                value={formData.websiteUrl} 
                onChange={e => setFormData({...formData, websiteUrl: e.target.value})}
                placeholder="https://brand.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Partner Tier</Label>
              <Select value={formData.tier} onValueChange={val => setFormData({...formData, tier: val})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gold">Gold Partner</SelectItem>
                  <SelectItem value="silver">Silver Partner</SelectItem>
                  <SelectItem value="bronze">Bronze Sponsor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleAddSponsor} disabled={isAdding || !formData.name}>
              {isAdding ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              Register Partner
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 bg-card/50 border-border">
          <CardHeader>
            <CardTitle>Current Partnerships</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
            ) : sponsors && sponsors.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Link</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sponsors.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-bold">{s.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          s.tier === "gold" ? "border-amber-400 text-amber-400" :
                          s.tier === "silver" ? "border-slate-300 text-slate-300" :
                          "border-orange-400 text-orange-400"
                        )}>
                          {s.tier.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {s.websiteUrl && (
                          <a href={s.websiteUrl} target="_blank" className="text-primary hover:underline flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" /> Visit
                          </a>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteSponsor(s.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground italic">No partners added yet for this club.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
