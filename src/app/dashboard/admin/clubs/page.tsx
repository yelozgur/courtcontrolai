'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MapPin, Mail, ExternalLink, Loader2, Search, Building2, User, Trophy, BarChart3 } from 'lucide-react';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog"

export default function AdminClubsPage() {
  const db = useFirestore();
  const [search, setSearch] = useState('');
  const [selectedClub, setSelectedClub] = useState<any>(null);

  const clubsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'clubs'), orderBy('createdAt', 'desc'));
  }, [db]);
  
  const { data: clubs, loading } = useCollection(clubsQuery);

  const filtered = clubs?.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.contactEmail.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold uppercase tracking-tighter">Manage Clubs</h1>
          <p className="text-muted-foreground font-medium">Overview of all sports organizations registered on Court Control AI.</p>
        </div>
      </div>

      <Card className="bg-card/50 border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Organizations Registry</CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clubs..."
                className="pl-10 bg-secondary/30 border-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="animate-spin text-primary h-8 w-8" />
            </div>
          ) : filtered && filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="uppercase text-[10px] font-bold tracking-widest text-muted-foreground">Club Name</TableHead>
                  <TableHead className="uppercase text-[10px] font-bold tracking-widest text-muted-foreground">Location</TableHead>
                  <TableHead className="uppercase text-[10px] font-bold tracking-widest text-muted-foreground">Courts</TableHead>
                  <TableHead className="uppercase text-[10px] font-bold tracking-widest text-muted-foreground">Contact</TableHead>
                  <TableHead className="text-right pr-6 uppercase text-[10px] font-bold tracking-widest text-muted-foreground">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((club) => (
                  <TableRow key={club.id} className="border-white/5 hover:bg-white/5 transition-colors">
                    <TableCell className="font-bold flex items-center gap-3">
                       <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center overflow-hidden">
                         {club.logoUrl ? <img src={club.logoUrl} className="w-full h-full object-cover" /> : <Building2 className="w-4 h-4 text-primary" />}
                       </div>
                       {club.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {club.location || 'Not Specified'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-white/5 text-muted-foreground border-none">{club.numCourts} Courts</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs">
                        <Mail className="h-3 w-3 opacity-50" /> {club.contactEmail}
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Dialog>
                        <DialogTrigger asChild>
                           <Button variant="ghost" size="icon" onClick={() => setSelectedClub(club)} className="hover:bg-primary/10 hover:text-primary">
                             <ExternalLink className="h-4 w-4" />
                           </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md bg-card border-white/10">
                           <DialogHeader>
                              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                                {club.logoUrl ? <img src={club.logoUrl} className="w-12 h-12 object-contain" /> : <Building2 className="w-8 h-8 text-primary" />}
                              </div>
                              <DialogTitle className="text-2xl font-headline font-bold uppercase">{club.name}</DialogTitle>
                              <DialogDescription>Detailed organization profile and metrics.</DialogDescription>
                           </DialogHeader>
                           <div className="grid gap-6 py-6">
                              <div className="grid grid-cols-2 gap-4">
                                 <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1"><Trophy className="h-3 w-3" /> Sport</p>
                                    <p className="font-bold capitalize">{club.primarySport}</p>
                                 </div>
                                 <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1"><BarChart3 className="h-3 w-3" /> AI Usage</p>
                                    <p className="font-bold">{club.aiUsageCount || 0} Runs</p>
                                 </div>
                              </div>
                              <div className="space-y-4">
                                 <div className="flex items-center gap-3">
                                    <User className="h-4 w-4 text-accent" />
                                    <div>
                                       <p className="text-[10px] font-bold text-muted-foreground uppercase">Owner Identification</p>
                                       <p className="text-sm font-mono opacity-60">{club.ownerId}</p>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-3">
                                    <Mail className="h-4 w-4 text-primary" />
                                    <div>
                                       <p className="text-[10px] font-bold text-muted-foreground uppercase">Direct Contact</p>
                                       <p className="text-sm font-bold">{club.contactEmail}</p>
                                    </div>
                                 </div>
                              </div>
                           </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-20 italic text-muted-foreground border-2 border-dashed rounded-3xl border-white/5">No clubs registered yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}