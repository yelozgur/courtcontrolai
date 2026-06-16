
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Building, MapPin, Mail, ExternalLink, Loader2, Search } from 'lucide-react';
import { collection, query, limit } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { useState } from 'react';
import { Input } from '@/components/ui/input';

export default function AdminClubsPage() {
  const db = useFirestore();
  const [search, setSearch] = useState('');

  const clubsQuery = collection(db!, 'clubs');
  const { data: clubs, loading } = useCollection(clubsQuery);

  const filtered = clubs?.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.contactEmail.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Manage Clubs</h1>
          <p className="text-muted-foreground">Overview of all sports organizations registered on the platform.</p>
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
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : filtered && filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Club Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Courts</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((club) => (
                  <TableRow key={club.id}>
                    <TableCell className="font-bold">{club.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {club.location}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{club.numCourts} Courts</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Mail className="h-3 w-3" /> {club.contactEmail}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-20 italic text-muted-foreground">No clubs registered yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
