
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  Loader2
} from "lucide-react"
import { collection, query, limit, where } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection, useUser } from "@/firebase"

export default function ParticipantManagement() {
  const db = useFirestore()
  const { user } = useUser()
  const [searchTerm, setSearchTerm] = useState("")

  // Get current user's clubId
  const clubsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "clubs"), where("ownerId", "==", user.uid), limit(1))
  }, [db, user])

  const { data: userClubs } = useCollection(clubsQuery)
  const clubId = userClubs?.[0]?.id

  const participantsQuery = useMemoFirebase(() => {
    if (!db || !clubId) return null
    return query(collection(db, "participants"), where("clubId", "==", clubId), limit(50))
  }, [db, clubId])

  const { data: participants, loading } = useCollection(participantsQuery)

  const filteredParticipants = participants?.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!clubId && !loading) return <div className="p-8">No club found. Please register your club first.</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Club Roster</h1>
          <p className="text-muted-foreground">Manage players registered for your club's tournaments.</p>
        </div>
        <Button className="bg-primary">
          <UserPlus className="mr-2 h-4 w-4" /> Add Player
        </Button>
      </div>

      <Card className="bg-card/50 border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Player Registry</CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search players..." 
                className="pl-10" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredParticipants && filteredParticipants.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Skill Level</TableHead>
                  <TableHead>Telegram</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParticipants.map((player) => (
                  <TableRow key={player.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold">{player.name}</span>
                        <span className="text-xs text-muted-foreground flex items-center">
                          <Mail className="mr-1 h-3 w-3" /> {player.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {player.skillLevel || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {player.telegramHandle ? (
                        <div className="flex items-center text-accent text-sm font-medium">
                          <MessageSquare className="mr-1 h-3 w-3" /> {player.telegramHandle}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Not connected</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                        Verified
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-20 bg-secondary/10 rounded-xl border-dashed border-2 border-border">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
              <p className="text-muted-foreground">No players found in your club roster yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
