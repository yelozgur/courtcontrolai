
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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const commonItems = [
  { name: 'Overview', icon: LayoutDashboard, href: '/dashboard' },
];

const clubItems = [
  { name: 'Tournament Wizard', icon: Trophy, href: '/dashboard/tournaments/new' },
  { name: 'Scheduling', icon: Calendar, href: '/dashboard/schedule' },
  { name: 'Participants', icon: Users, href: '/dashboard/participants' },
  { name: 'Referee Console', icon: Gavel, href: '/referee' },
  { name: 'Sponsors', icon: Heart, href: '/dashboard/sponsors' },
  { name: 'Check-In (QR)', icon: QrCode, href: '/dashboard/check-in' },
  { name: 'Arena Dashboard', icon: Monitor, href: '/arena' },
  { name: 'Club Settings', icon: Settings, href: '/dashboard/club' },
];

const adminItems = [
  { name: 'Manage Clubs', icon: Building, href: '/dashboard/admin/clubs' },
  { name: 'Manage Users', icon: ShieldCheck, href: '/dashboard/admin/users' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading: authLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();

  const isAdmin = user?.email?.toLowerCase() === 'admin@deneme.com';

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);
  
  const { data: profile, loading: profileLoading } = useDoc(userProfileRef);

  const clubsQuery = useMemoFirebase(() => {
    if (!db || !user || isAdmin) return null;
    return query(collection(db, 'clubs'), where('ownerId', '==', user.uid), limit(1));
  }, [db, user, isAdmin]);

  const { data: userClubs, loading: clubsLoading } = useCollection(clubsQuery);
  const userClub = userClubs?.[0];

  const [onboardingName, setOnboardingName] = React.useState('');
  const [isOnboarding, setIsOnboarding] = React.useState(false);

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const handleSignOut = () => {
    signOut(auth).then(() => router.push('/'));
  };

  const handleCreateClub = () => {
    if (!db || !user || !onboardingName) return;
    setIsOnboarding(true);
    
    const clubRef = doc(collection(db, 'clubs'));
    const userRef = doc(db, 'users', user.uid);

    const newClub = {
      ownerId: user.uid,
      name: onboardingName,
      contactEmail: user.email || '',
      numCourts: 1,
      location: 'Pending Set-up',
      primarySport: 'padel',
      createdAt: serverTimestamp()
    };

    setDoc(clubRef, newClub)
      .catch(async (e) => {
        const error = new FirestorePermissionError({
          path: clubRef.path,
          operation: 'create',
          requestResourceData: newClub
        });
        errorEmitter.emit('permission-error', error);
      });

    updateDoc(userRef, {
      clubId: clubRef.id,
    }).catch(async (e) => {
       const error = new FirestorePermissionError({
        path: userRef.path,
        operation: 'update',
        requestResourceData: { clubId: clubRef.id }
      });
      errorEmitter.emit('permission-error', error);
    });
  };

  const isSyncing = authLoading || (!isAdmin && (clubsLoading || profileLoading));

  if (isSyncing) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#0F172A] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse font-medium uppercase tracking-[0.2em] text-xs">Synchronizing With CourtControl...</p>
      </div>
    );
  }

  if (!user) return null;

  const hasNoClub = !isAdmin && !userClub && !profile?.clubId && !isOnboarding;

  if (hasNoClub) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F172A] p-6">
        <Card className="w-full max-w-md border-white/5 bg-card/50 backdrop-blur-xl">
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
              <PlusCircle className="text-white h-7 w-7" />
            </div>
            <CardTitle className="text-2xl font-headline font-bold uppercase tracking-tight">Register Your Club</CardTitle>
            <CardDescription>
              To start managing tournaments and live scores, register your sports organization first.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Club Name</Label>
              <Input
                placeholder="e.g. Ace Padel Academy"
                value={onboardingName}
                onChange={(e) => setOnboardingName(e.target.value)}
                className="bg-white/5 border-white/10"
              />
            </div>
            <Button className="w-full bg-primary h-12 font-bold uppercase" onClick={handleCreateClub} disabled={!onboardingName || isOnboarding}>
              {isOnboarding ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              Create Club Dashboard
            </Button>
            <Button variant="ghost" className="w-full text-muted-foreground hover:bg-white/5" onClick={handleSignOut}>
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const navItems = isAdmin ? [...commonItems, ...adminItems] : [...commonItems, ...clubItems];

  return (
    <div className="flex h-screen overflow-hidden bg-[#0F172A]">
      <aside className="w-64 border-r border-white/5 bg-card/30 backdrop-blur-xl hidden md:flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Zap className="text-white h-5 w-5" />
            </div>
            <span className="font-headline font-bold text-lg tracking-tight text-white uppercase">CourtControl</span>
          </Link>
        </div>
        <ScrollArea className="flex-1 px-3">
          <div className="px-3 mb-4">
            <div className="p-3 rounded-xl bg-white/5 border border-white/5">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                {isAdmin ? 'System Admin' : 'Active Club'}
              </p>
              <p className="text-sm font-bold truncate text-primary mt-1">
                {isAdmin ? 'Platform Manager' : (userClub?.name || 'Club Owner')}
              </p>
            </div>
          </div>
          <div className="space-y-1 py-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center rounded-xl px-4 py-3 text-sm font-medium transition-all hover:bg-primary/10 hover:text-primary',
                  pathname === item.href ? 'bg-primary/20 text-primary shadow-sm border border-primary/20' : 'text-muted-foreground'
                )}
              >
                <item.icon
                  className={cn(
                    'mr-3 h-5 w-5 transition-colors',
                    pathname === item.href ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
                  )}
                />
                {item.name}
              </Link>
            ))}
          </div>
        </ScrollArea>
        <div className="p-4 mt-auto border-t border-white/5 space-y-2">
          <div className="flex items-center gap-3 px-3 py-3 bg-white/5 rounded-2xl border border-white/5">
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary overflow-hidden border border-primary/20">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                profile?.displayName?.substring(0, 2).toUpperCase() || user?.displayName?.substring(0, 2).toUpperCase() || '?'
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate text-white">{profile?.displayName || user?.displayName || 'User'}</p>
              <p className="text-[10px] text-muted-foreground truncate uppercase tracking-tighter">{isAdmin ? 'Administrator' : (profile?.role || 'Member')}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={handleSignOut}
          >
            <LogOut className="mr-3 h-5 w-5" /> Sign Out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="container max-w-7xl mx-auto p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
