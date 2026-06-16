
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
import { doc, collection, query, where, limit, addDoc, updateDoc } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

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

  // Get the user profile to check role
  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);
  const { data: profile, loading: profileLoading } = useDoc(userProfileRef);

  const isAdmin = profile?.role === 'admin';

  // Get the user's club (if not admin)
  const clubsQuery = useMemoFirebase(() => {
    if (!db || !user || isAdmin) return null;
    return query(collection(db, 'clubs'), where('ownerId', '==', user.uid), limit(1));
  }, [db, user, isAdmin]);

  const { data: userClubs, loading: clubsLoading } = useCollection(clubsQuery);
  const userClub = userClubs?.[0];

  // Onboarding State
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

  const handleCreateClub = async () => {
    if (!db || !user || !onboardingName) return;
    setIsOnboarding(true);
    try {
      const clubRef = await addDoc(collection(db, 'clubs'), {
        ownerId: user.uid,
        name: onboardingName,
        contactEmail: user.email || '',
        numCourts: 1,
        location: 'Pending Set-up',
      });

      await updateDoc(doc(db, 'users', user.uid), {
        clubId: clubRef.id,
      });

      router.refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setIsOnboarding(false);
    }
  };

  if (authLoading || profileLoading || (user && !isAdmin && clubsLoading)) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  // If no club exists and not admin, force onboarding
  if (!isAdmin && !userClub) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F172A] p-6">
        <Card className="w-full max-w-md border-white/5 bg-card/50 backdrop-blur-xl">
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
              <PlusCircle className="text-white h-7 w-7" />
            </div>
            <CardTitle className="text-2xl font-headline font-bold">Register Your Club</CardTitle>
            <CardDescription>
              To start managing tournaments, you first need to register your sports club or organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Club Name</Label>
              <Input
                placeholder="e.g. Smash Padel Academy"
                value={onboardingName}
                onChange={(e) => setOnboardingName(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={handleCreateClub} disabled={!onboardingName || isOnboarding}>
              {isOnboarding ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              Create My Club Dashboard
            </Button>
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={handleSignOut}>
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const navItems = isAdmin ? [...commonItems, ...adminItems] : [...commonItems, ...clubItems];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card/30 backdrop-blur-xl hidden md:flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Zap className="text-primary-foreground h-5 w-5" />
            </div>
            <span className="font-headline font-bold text-lg tracking-tight">CourtControl</span>
          </Link>
        </div>
        <ScrollArea className="flex-1 px-3">
          <div className="px-3 mb-4">
            <div className="p-2 rounded-lg bg-secondary/50 border border-white/5">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                {isAdmin ? 'System Admin' : 'Active Club'}
              </p>
              <p className="text-xs font-bold truncate text-primary">{isAdmin ? 'All Organizations' : userClub?.name}</p>
            </div>
          </div>
          <div className="space-y-1 py-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-all hover:bg-primary/10 hover:text-primary',
                  pathname === item.href ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground'
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
        <div className="p-4 mt-auto border-t border-border space-y-2">
          <div className="flex items-center gap-3 px-3 py-2 bg-secondary/50 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary overflow-hidden">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                profile?.displayName?.substring(0, 2).toUpperCase() || '?'
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.displayName || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate capitalize">{profile?.role || 'Member'}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-destructive"
            onClick={handleSignOut}
          >
            <LogOut className="mr-3 h-5 w-5" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container max-w-7xl mx-auto p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
