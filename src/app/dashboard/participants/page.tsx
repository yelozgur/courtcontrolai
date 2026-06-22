"use client"

import { useState } from "react"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
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
  Users, 
  UserPlus, 
  Search, 
  MoreVertical,
  Loader2,
  Share2,
  Copy,
  Check,
  Shirt
} from "lucide-react"
import { collection, query, limit, where, addDoc } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection, useUser } from "@/firebase"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

export default function ParticipantManagement() {
  const db = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  
  const [newPlayer, setNewPlayer] = useState({
    name: "",
    email: "",
    skillLevel: "intermediate",
    telegramHandle: ""
  })

  // Get current user's clubId
  const clubsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "clubs"), where("ownerId", "==", user.uid), limit(1))
  }, [db, user])

  const { data: userClubs } = useCollection(clubsQuery)
  const clubId = userClubs?.[0]?.id

  // Get tournaments for link generation
  const tournamentsQuery = useMemoFirebase(() => {
    if (!db || !clubId) return null
    return query(collection(db, "tournaments"), where("clubId", "==", clubId))
  }, [db, clubId])

  const { data: tournaments } = useCollection(tournamentsQuery)

  const participantsQuery = useMemoFirebase(() => {
    if (!db || !clubId) return null
    return query(collection(db, "participants"), where("clubId", "==", clubId), limit(100))
  }, [db, clubId])

  const { data: participants, loading } = useCollection(participantsQuery)

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const registerUrl = selectedTournamentId ? `${origin}/tournaments/${selectedTournamentId}/register` : '';
  
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(registerUrl)}&bgcolor=FFFFFF&color=0F172A&margin=10`;

  const copyToClipboard = (url: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast({ title: "Link Copied", description: "Registration URL copied to clipboard." });
    setTimeout(() => setCopied(false), 2000);
  }

  const handleAddPlayer = () => {
    if (!db || !clubId || !newPlayer.name || !newPlayer.email) return
    setIsAdding(true)
    
    const playerData = {
      ...newPlayer,
      clubId,
      verified: true,
      createdAt: new Date().toISOString()
    }

    const participantsRef = collection(db, "participants")
    addDoc(participantsRef, playerData)
      .then(() => {
        toast({ title: "Player Added", description: `${newPlayer.name} has been added to the roster.` })
        setNewPlayer({ name: "", email: "", skillLevel: "intermediate", telegramHandle: "" })
        setIsAdding(false)
        setIsDialogOpen(false)
      })
      .catch(async (e) => {
        const error = new FirestorePermissionError({
          path: 'participants',
          operation: 'create',
          requestResourceData: playerData
        })
        errorEmitter.emit('permission-error', error)
        setIsAdding(false)
      })
  }

  const filteredParticipants = participants?.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!clubId && !loading) return <div className="p-8 text-center text-muted-foreground">Please register your club first.</div>

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-white uppercase tracking-tighter">Club Roster</h1>
          <p className="text-muted-foreground">Grow and manage your player database.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
                <UserPlus className="mr-2 h-4 w-4" /> Manual Entry
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add New Player</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input placeholder="John Doe" value={newPlayer.name} onChange={(e) => setNewPlayer({...newPlayer, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" placeholder="john@example.com" value={newPlayer.email} onChange={(e) => setNewPlayer({...newPlayer, email: e.target.value})} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddPlayer} disabled={isAdding || !newPlayer.name || !newPlayer.email}>
                  {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add to Roster
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-card/50 border-primary/20 shadow-lg shadow-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary"><Share2 className="h-5 w-5" /> Invite Players</CardTitle>
              <CardDescription>Generate registration QR for events.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Select onValueChange={setSelectedTournamentId} value={selectedTournamentId || undefined}>
                <SelectTrigger className="bg-secondary/30"><SelectValue placeholder="Select Tournament" /></SelectTrigger>
                <SelectContent>
                  {tournaments?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>

              {selectedTournamentId && (
                <div className="space-y-4">
                  <div className="p-4 bg-white rounded-2xl flex justify-center">
                    <Image 
                      src={qrCodeUrl} 
                      alt="QR" 
                      width={140}
                      height={140}
                      unoptimized
                    />
                  </div>
                  <Button variant="default" className="w-full" onClick={() => copyToClipboard(registerUrl)}>{copied ? <Check className="mr-2 h-3 w-3" /> : <Copy className="mr-2 h-3 w-3" />} Copy URL</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8">
          <Card className="bg-card/50 border-border">
            <CardHeader className="pb-3 border-b border-white/5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Player Registry</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search roster..." className="pl-10 bg-secondary/20 border-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : filteredParticipants && filteredParticipants.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-none hover:bg-transparent">
                      <TableHead className="pl-6 uppercase text-[10px] font-bold tracking-widest text-muted-foreground">Player</TableHead>
                      <TableHead className="uppercase text-[10px] font-bold tracking-widest text-muted-foreground">Pack Details</TableHead>
                      <TableHead className="uppercase text-[10px] font-bold tracking-widest text-muted-foreground">Level</TableHead>
                      <TableHead className="text-right pr-6 uppercase text-[10px] font-bold tracking-widest text-muted-foreground">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredParticipants.map((player) => (
                      <TableRow key={player.id} className="border-white/5 hover:bg-white/5 transition-colors">
                        <TableCell className="pl-6">
                          <div className="flex flex-col">
                            <span className="font-bold text-white">{player.name}</span>
                            <span className="text-xs text-muted-foreground">{player.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {player.packSize ? (
                            <div className="flex items-center gap-2 text-accent text-xs font-bold uppercase">
                               <Shirt className="h-3 w-3" /> Size: {player.packSize}
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">No selection</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-[10px] border-primary/20 text-primary">{player.skillLevel}</Badge>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10"><MoreVertical className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-32 opacity-20"><Users className="h-16 w-16 mx-auto mb-4" /><p className="text-xl font-bold uppercase tracking-tighter">Empty Roster</p></div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}