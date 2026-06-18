
"use client"

import { useState } from "react"
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
  Mail, 
  MessageSquare,
  MoreVertical,
  Loader2,
  Plus,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Trophy
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
  
  // Real QR Code API URL
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
              <DialogHeader>
                <DialogTitle>Add New Player</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input 
                    placeholder="John Doe" 
                    value={newPlayer.name}
                    onChange={(e) => setNewPlayer({...newPlayer, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input 
                    type="email" 
                    placeholder="john@example.com" 
                    value={newPlayer.email}
                    onChange={(e) => setNewPlayer({...newPlayer, email: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Skill Level</Label>
                    <Select 
                      value={newPlayer.skillLevel} 
                      onValueChange={(val) => setNewPlayer({...newPlayer, skillLevel: val})}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Telegram @Handle</Label>
                    <Input 
                      placeholder="@username" 
                      value={newPlayer.telegramHandle}
                      onChange={(e) => setNewPlayer({...newPlayer, telegramHandle: e.target.value})}
                    />
                  </div>
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
              <CardTitle className="flex items-center gap-2 text-primary">
                <Share2 className="h-5 w-5" />
                Invite Players
              </CardTitle>
              <CardDescription>Generate a functional registration QR for an event.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Target Tournament</Label>
                <Select onValueChange={setSelectedTournamentId} value={selectedTournamentId || undefined}>
                  <SelectTrigger className="bg-secondary/30">
                    <SelectValue placeholder="Select Tournament" />
                  </SelectTrigger>
                  <SelectContent>
                    {tournaments?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTournamentId ? (
                <div className="space-y-4 animate-in zoom-in-95 duration-300">
                  <div className="p-4 bg-white rounded-2xl flex justify-center">
                    <img 
                      src={qrCodeUrl} 
                      alt="Registration QR Code" 
                      className="w-[140px] h-[140px]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <a href={registerUrl} target="_blank"><ExternalLink className="mr-2 h-3 w-3" /> View</a>
                    </Button>
                    <Button variant="default" size="sm" className="flex-1" onClick={() => copyToClipboard(registerUrl)}>
                      {copied ? <Check className="mr-2 h-3 w-3" /> : <Copy className="mr-2 h-3 w-3" />} Copy
                    </Button>
                  </div>
                  <div className="p-2 bg-secondary/50 rounded border border-border overflow-hidden">
                    <code className="text-[9px] text-muted-foreground break-all">{registerUrl}</code>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center border border-dashed rounded-xl bg-secondary/10">
                  <Trophy className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                  <p className="text-xs text-muted-foreground">Select an event to get registration link</p>
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
                  <Input 
                    placeholder="Search roster..." 
                    className="pl-10 bg-secondary/20 border-none" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center p-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredParticipants && filteredParticipants.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-none hover:bg-transparent">
                      <TableHead className="pl-6 uppercase text-[10px] font-bold tracking-widest text-muted-foreground">Player</TableHead>
                      <TableHead className="uppercase text-[10px] font-bold tracking-widest text-muted-foreground">Level</TableHead>
                      <TableHead className="uppercase text-[10px] font-bold tracking-widest text-muted-foreground">Social</TableHead>
                      <TableHead className="uppercase text-[10px] font-bold tracking-widest text-muted-foreground">Status</TableHead>
                      <TableHead className="text-right pr-6 uppercase text-[10px] font-bold tracking-widest text-muted-foreground">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredParticipants.map((player) => (
                      <TableRow key={player.id} className="border-white/5 hover:bg-white/5 transition-colors">
                        <TableCell className="pl-6">
                          <div className="flex flex-col">
                            <span className="font-bold text-white">{player.name}</span>
                            <span className="text-xs text-muted-foreground flex items-center">
                              <Mail className="mr-1 h-3 w-3" /> {player.email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-[10px] border-primary/20 text-primary">
                            {player.skillLevel || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {player.telegramHandle ? (
                            <div className="flex items-center text-accent text-xs font-medium">
                              <MessageSquare className="mr-1 h-3 w-3" /> {player.telegramHandle}
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">No handle</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                             <span className="text-[10px] font-bold text-emerald-500 uppercase">Verified</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-32 opacity-20">
                  <Users className="h-16 w-16 mx-auto mb-4" />
                  <p className="text-xl font-bold uppercase tracking-tighter">Empty Roster</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
