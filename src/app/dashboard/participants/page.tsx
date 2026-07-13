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
  Shirt,
  Pencil,
  Trash2,
  Eye,
  ExternalLink
} from "lucide-react"
import { collection, query, limit, where, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection, useUser, useUserClub, useFilteredCollection } from "@/firebase"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

interface Player {
  id: string
  name?: string
  email?: string
  userId?: string
  clubId?: string
  packSize?: string
  skillLevel?: string
  verified?: boolean
  createdAt?: string
}

export default function ParticipantManagement() {
  const db = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Roster actions state
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editSkill, setEditSkill] = useState("intermediate")
  const [editPackSize, setEditPackSize] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const [removingPlayer, setRemovingPlayer] = useState<Player | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)

  const [newPlayer, setNewPlayer] = useState({
    name: "",
    email: "",
    skillLevel: "intermediate",
    telegramHandle: ""
  })

  // Get current user's clubId (client-side filter workaround)
  const { clubId } = useUserClub()

  // Get tournaments for link generation (client-side filter)
  const { data: tournaments } = useFilteredCollection<any>(
    "tournaments",
    clubId ? (t: any) => t.clubId === clubId : undefined,
    { deps: [clubId] }
  )

  // Get participants (client-side filter)
  const { data: participants, loading } = useFilteredCollection<any>(
    "participants",
    clubId ? (p: any) => p.clubId === clubId : undefined,
    { deps: [clubId] }
  )

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

  const openEdit = (p: Player) => {
    setEditingPlayer(p)
    setEditName(p.name || "")
    setEditEmail(p.email || "")
    setEditSkill(p.skillLevel || "intermediate")
    setEditPackSize(p.packSize || "")
  }

  const handleSaveEdit = async () => {
    if (!db || !editingPlayer) return
    setIsSaving(true)
    try {
      await updateDoc(doc(db, "participants", editingPlayer.id), {
        name: editName,
        email: editEmail,
        skillLevel: editSkill,
        packSize: editPackSize || null,
      })
      toast({ title: "Player Updated", description: `${editName} has been updated.` })
      setEditingPlayer(null)
    } catch (e: any) {
      toast({
        title: "Update Failed",
        description: e.message,
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemove = async () => {
    if (!db || !removingPlayer) return
    setIsRemoving(true)
    try {
      await deleteDoc(doc(db, "participants", removingPlayer.id))
      toast({ title: "Player Removed", description: `${removingPlayer.name} has been removed from the roster.` })
      setRemovingPlayer(null)
    } catch (e: any) {
      toast({
        title: "Remove Failed",
        description: e.message,
        variant: "destructive"
      })
    } finally {
      setIsRemoving(false)
    }
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
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Actions</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => openEdit(player)}
                                className="text-xs"
                              >
                                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit Player
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  const userId = player.userId || player.id
                                  const win = window.open(`/dashboard/profile?userId=${userId}`, '_blank')
                                  if (!win) {
                                    toast({ title: "Popup Blocked", description: "Allow popups to view profile.", variant: "destructive" })
                                  }
                                }}
                                className="text-xs"
                              >
                                <Eye className="mr-2 h-3.5 w-3.5" /> View Profile
                                <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setRemovingPlayer(player)}
                                className="text-xs text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" /> Remove from Roster
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {/* Edit Player Dialog */}
      <Dialog open={!!editingPlayer} onOpenChange={(open) => !open && setEditingPlayer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Player</DialogTitle>
            <DialogDescription>Update player details. Changes are saved immediately.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Skill Level</Label>
                <Select value={editSkill} onValueChange={setEditSkill}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pack Size</Label>
                <Select value={editPackSize || "none"} onValueChange={(v) => setEditPackSize(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="No pack" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No selection</SelectItem>
                    <SelectItem value="S">S</SelectItem>
                    <SelectItem value="M">M</SelectItem>
                    <SelectItem value="L">L</SelectItem>
                    <SelectItem value="XL">XL</SelectItem>
                    <SelectItem value="XXL">XXL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPlayer(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving || !editName || !editEmail}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation AlertDialog */}
      <AlertDialog open={!!removingPlayer} onOpenChange={(open) => !open && setRemovingPlayer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removingPlayer?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the player from your club roster. Their tournament registrations and match history will remain intact, but they will no longer appear in your club's player database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={isRemoving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}