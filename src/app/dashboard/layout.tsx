
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Trophy,
  Calendar,
  Users,
  Settings,
  LayoutDashboard,
  QrCode,
  Monitor,
  Zap,
  LogOut,
  Loader2,
  Heart,
  PlusCircle,
  ShieldCheck,
  Building,
  Gavel,
  AlertCircle,
  RefreshCw,
  User,
  Activity
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUser, useAuth, useDoc, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { doc, collection, query, where, limit, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading: authLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);
  
  const { data: profile, loading: profileLoading } = useDoc(userProfileRef);

  const isAdmin = profile?.role === 'admin' || user?.email?.toLowerCase() === 'admin@deneme.com';
  const isClubOwner = profile?.role === 'club_owner' || isAdmin;
  const isReferee = profile?.role === 'referee' || isAdmin;
  const isPlayer = profile?.role === 'player' || (!profile?.role && !profileLoading && user);

  const clubsQuery = useMemoFirebase(() => {
    if (!db || !user || !isClubOwner) return null;
    // Admins see everything, but for the layout we only check their own club
    return query(collection(db, 'clubs'), where('ownerId', '==', user.uid), limit(1));
  }, [db, user, isClubOwner]);

  const { data: userClubs, loading: clubsLoading } = useCollection(clubsQuery);
  const userClub = userClubs?.[0];

  const handleSignOut = () => signOut(auth).then(() => router.push('/'));

  const handleCreateClub = async (name: string) => {
    if (!db || !user) return;
    const clubRef = doc(collection(db, 'clubs'));
    await setDoc(clubRef, {
      ownerId: user.uid,
      name,
      contactEmail: user.email || '',
      numCourts: 1,
      createdAt: serverTimestamp(),
      primarySport: 'padel'
    });
    await updateDoc(doc(db, 'users', user.uid), { role: 'club_owner', clubId: clubRef.id });
  };

  if (authLoading || (user && profileLoading)) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#0F172A] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse text-xs uppercase tracking-widest font-bold">Syncing Profile...</p>
      </div>
    );
  }

  if (!user) return null;

  // Onboarding for new owners who haven't registered a club yet
  if (isClubOwner && !userClub && !clubsLoading && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F172A] p-6">
        <Card className="w-full max-w-md bg-card/50 border-white/5">
          <CardHeader className="text-center">
            <Building className="h-12 w-12 text-primary mx-auto mb-4" />
            <CardTitle>Organization Registry</CardTitle>
            <CardDescription>Enter your club name to unlock the manager dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="onboarding-name">Club Name</Label>
              <Input id="onboarding-name" placeholder="Ace Academy" />
            </div>
            <Button className="w-full" onClick={() => {
              const el = document.getElementById('onboarding-name') as HTMLInputElement;
              if (el.value) handleCreateClub(el.value);
            }}>Launch Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const navItems = [
    { name: 'Overview', icon: LayoutDashboard, href: '/dashboard', show: true },
    { name: 'Scheduling', icon: Calendar, href: '/dashboard/schedule', show: isClubOwner },
    { name: 'Participants', icon: Users, href: '/dashboard/participants', show: isClubOwner },
    { name: 'Check-In Hub', icon: QrCode, href: '/dashboard/check-in', show: isClubOwner },
    { name: 'Partners', icon: Heart, href: '/dashboard/sponsors', show: isClubOwner },
    { name: 'Referee Hub', icon: Gavel, href: '/referee', show: isReferee || isClubOwner },
    { name: 'My Profile', icon: User, href: '/dashboard/profile', show: true },
    { name: 'Club Settings', icon: Building, href: '/dashboard/club', show: isClubOwner },
    { name: 'Admin Panels', icon: ShieldCheck, href: '/dashboard/admin/users', show: isAdmin },
  ].filter(item => item.show);

  return (
    <div className="flex h-screen overflow-hidden bg-[#0F172A]">
      <aside className="w-64 border-r border-white/5 bg-card/30 backdrop-blur-xl hidden md:flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <Zap className="text-primary h-6 w-6" />
          <span className="font-headline font-bold text-lg text-white uppercase tracking-tighter">CourtControl</span>
        </div>
        <ScrollArea className="flex-1 px-3">
          <div className="space-y-1 py-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center rounded-xl px-4 py-3 text-sm font-medium transition-all hover:bg-primary/10 hover:text-primary',
                  pathname === item.href ? 'bg-primary/20 text-primary border border-primary/20 shadow-[0_0_15px_rgba(139,92,246,0.1)]' : 'text-muted-foreground'
                )}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            ))}
          </div>
        </ScrollArea>
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl mb-2 border border-white/5">
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary border border-primary/20">
              {profile?.displayName?.charAt(0) || user.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate text-white">{profile?.displayName || 'User'}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">{profile?.role || 'Player'}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={handleSignOut}>
            <LogOut className="mr-3 h-5 w-5" /> Sign Out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-background/50 relative">
        <div className="container max-w-7xl mx-auto p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
