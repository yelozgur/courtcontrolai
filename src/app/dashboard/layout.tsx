
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Trophy,
  Calendar,
  Users,
  LayoutDashboard,
  QrCode,
  Zap,
  LogOut,
  Loader2,
  Heart,
  ShieldCheck,
  Building,
  Gavel,
  User,
  Calculator
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUser, useAuth, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { doc } from 'firebase/firestore';

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
  const isClubOwner = profile?.role === 'club_owner' || isAdmin || true; 
  const isReferee = profile?.role === 'referee' || isAdmin;

  const handleSignOut = () => signOut(auth).then(() => router.push('/'));

  if (authLoading || (user && profileLoading)) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#0F172A] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse text-xs uppercase tracking-widest font-bold">Syncing Console...</p>
      </div>
    );
  }

  if (!user) return null;

  const navItems = [
    { name: 'Overview', icon: LayoutDashboard, href: '/dashboard', show: true },
    { name: 'Tournaments', icon: Trophy, href: '/dashboard/tournaments/new', show: isClubOwner },
    { name: 'Scheduling', icon: Calendar, href: '/dashboard/schedule', show: isClubOwner },
    { name: 'Participants', icon: Users, href: '/dashboard/participants', show: isClubOwner },
    { name: 'Check-In Hub', icon: QrCode, href: '/dashboard/check-in', show: isClubOwner },
    { name: 'Partners', icon: Heart, href: '/dashboard/sponsors', show: isClubOwner },
    { name: 'Referee Hub', icon: Gavel, href: '/referee', show: isReferee || isClubOwner },
    { name: 'My Profile', icon: User, href: '/dashboard/profile', show: true },
    { name: 'Club Settings', icon: Building, href: '/dashboard/club', show: isClubOwner },
    { name: 'Cost Analytics', icon: Calculator, href: '/dashboard/admin/costs', show: isAdmin },
    { name: 'Admin Users', icon: ShieldCheck, href: '/dashboard/admin/users', show: isAdmin },
  ].filter(item => item.show);

  return (
    <div className="flex h-screen overflow-hidden bg-[#0F172A]">
      <aside className="w-64 border-r border-white/5 bg-card/30 backdrop-blur-xl hidden md:flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="3" width="18" height="18" rx="4" className="stroke-primary-foreground" strokeWidth="2"/>
              <circle cx="12" cy="12" r="3" className="stroke-primary-foreground" strokeWidth="2"/>
              <path d="M12 9V15M9 12H15" className="stroke-accent" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="font-headline font-bold text-lg text-white uppercase tracking-tighter">Court Control AI</span>
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
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">{profile?.role || 'User'}</p>
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
