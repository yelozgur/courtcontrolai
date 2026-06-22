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
import { 
  ShieldCheck, 
  Mail, 
  Calendar, 
  Loader2, 
  Search, 
  User, 
  MoreVertical,
  Check,
  AlertCircle,
  Gavel,
  Building,
  Gamepad2
} from 'lucide-react';
import { collection, doc, updateDoc, query, limit } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';

export default function AdminUsersPage() {
  const db = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const isAdmin = currentUser?.email?.toLowerCase() === 'admin@deneme.com';

  const usersQuery = useMemoFirebase(() => {
    if (!db || !isAdmin) return null;
    return query(collection(db, 'users'), limit(100));
  }, [db, isAdmin]);

  const { data: users, loading, error } = useCollection(usersQuery);

  const handleUpdateRole = (userId: string, newRole: string) => {
    if (!db) return;
    setUpdatingId(userId);
    const userRef = doc(db, 'users', userId);
    
    updateDoc(userRef, { role: newRole })
      .then(() => {
        toast({
          title: "Role Updated",
          description: `User role changed to ${newRole}.`,
        });
      })
      .catch(async (e) => {
        const error = new FirestorePermissionError({
          path: userRef.path,
          operation: 'update',
          requestResourceData: { role: newRole }
        });
        errorEmitter.emit('permission-error', error);
      })
      .finally(() => setUpdatingId(null));
  };

  const filtered = users?.filter((u) =>
    u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (!isAdmin && !loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-2xl font-bold">Unauthorized Access</h2>
        <p className="text-muted-foreground">Only the system administrator can access the user registry.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold uppercase tracking-tighter">System Users</h1>
          <p className="text-muted-foreground">Manage roles and permissions for the entire platform.</p>
        </div>
      </div>

      <Card className="bg-card/50 border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Registry</CardTitle>
              <CardDescription>Grant Club Owner or Referee status to registered users.</CardDescription>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                className="pl-10 bg-secondary/30 border-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-20">
              <Loader2 className="animate-spin text-primary h-10 w-10" />
            </div>
          ) : error ? (
            <div className="p-12 text-center text-destructive flex flex-col items-center gap-2">
              <AlertCircle className="h-8 w-8" />
              <p>Failed to load user registry.</p>
            </div>
          ) : filtered && filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="pl-6 uppercase text-[10px] font-bold tracking-widest text-muted-foreground">Identity</TableHead>
                  <TableHead className="uppercase text-[10px] font-bold tracking-widest text-muted-foreground">System Role</TableHead>
                  <TableHead className="uppercase text-[10px] font-bold tracking-widest text-muted-foreground">Joined</TableHead>
                  <TableHead className="text-right pr-6 uppercase text-[10px] font-bold tracking-widest text-muted-foreground">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.id} className="border-white/5 hover:bg-white/5 transition-colors">
                    <TableCell className="pl-6">
                      <div className="flex flex-col">
                        <span className="font-bold flex items-center gap-2 text-white">
                          {user.displayName} {user.role === 'admin' && <ShieldCheck className="h-3 w-3 text-accent" />}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {user.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className={cn(
                        "capitalize border-none",
                        user.role === 'admin' ? "bg-accent text-accent-foreground" :
                        user.role === 'club_owner' ? "bg-primary/20 text-primary" :
                        user.role === 'referee' ? "bg-orange-500/20 text-orange-500" :
                        "bg-white/5 text-muted-foreground"
                      )}>
                        {user.role?.replace('_', ' ') || 'Player'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                        <Calendar className="h-3 w-3" />{' '}
                        {user.createdAt ? (typeof user.createdAt === 'string' ? user.createdAt.split('T')[0] : user.createdAt.toDate().toLocaleDateString()) : 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={updatingId === user.id} className="hover:bg-white/10">
                            {updatingId === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreVertical className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card border-white/10">
                          <DropdownMenuLabel>Change System Role</DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-white/5" />
                          <DropdownMenuItem onClick={() => handleUpdateRole(user.id, 'admin')} className="text-accent">
                            <ShieldCheck className="mr-2 h-4 w-4" /> Platform Admin
                            {user.role === 'admin' && <Check className="ml-auto h-4 w-4" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUpdateRole(user.id, 'club_owner')} className="text-primary">
                            <Building className="mr-2 h-4 w-4" /> Club Owner
                            {user.role === 'club_owner' && <Check className="ml-auto h-4 w-4" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUpdateRole(user.id, 'referee')} className="text-orange-400">
                            <Gavel className="mr-2 h-4 w-4" /> Match Referee
                            {user.role === 'referee' && <Check className="ml-auto h-4 w-4" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUpdateRole(user.id, 'player')}>
                            <Gamepad2 className="mr-2 h-4 w-4" /> Standard Player
                            {(user.role === 'player' || !user.role) && <Check className="ml-auto h-4 w-4" />}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-20 italic text-muted-foreground">No users found.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
