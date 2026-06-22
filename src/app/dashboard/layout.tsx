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
  Calculator,
  Users2,
  Megaphone,
  Menu,
  ChevronLeft
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUser, useAuth, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading: authLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);
  
  const { data: profile, loading: profileLoading } = useDoc(userProfileRef);

  const isAdmin = profile?.role === 'admin' || user?.email?.toLowerCase() === 'admin@deneme.com';
  const isClubManager = isAdmin || profile?.role === 'club_owner' || profile?.role === 'user' || !profile?.role;
  const isReferee = profile?.role === 'referee';

  const handleSignOut = () => {
    setIsMobileMenuOpen(false);
    signOut(auth).then(() => router.push('/'));
  };

  if (authLoading || (user && profileLoading)) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#0F172A] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse text-xs uppercase tracking-widest font-bold">Syncing Console...</p>
      </div>
    );
  }

  if (!user) return null;

  const navItems = isAdmin ? [
    { name: 'SaaS Overview', icon: LayoutDashboard, href: '/dashboard' },
    { name: 'Marketing Center', icon: Megaphone, href: '/dashboard/admin/marketing' },
    { name: 'Manage Clubs', icon: Building, href: '/dashboard/admin/clubs' },
    { name: 'System Users', icon: Users2, href: '/dashboard/admin/users' },
    { name: 'Revenue & Costs', icon: Calculator, href: '/dashboard/admin/costs' },
    { name: 'My Profile', icon: User, href: '/dashboard/profile' },
  ] : [
    { name: 'Club Console', icon: LayoutDashboard, href: '/dashboard', show: true },
    { name: 'Tournaments', icon: Trophy, href: '/dashboard/tournaments/new', show: isClubManager },
    { name: 'Match Planner', icon: Calendar, href: '/dashboard/schedule', show: isClubManager },
    { name: 'Participants', icon: Users, href: '/dashboard/participants', show: isClubManager },
    { name: 'Check-In Hub', icon: QrCode, href: '/dashboard/check-in', show: isClubManager },
    { name: 'Partners', icon: Heart, href: '/dashboard/sponsors', show: isClubManager },
    { name: 'Referee Hub', icon: Gavel, href: '/referee', show: isReferee || isClubManager },
    { name: 'My Profile', icon: User, href: '/dashboard/profile', show: true },
    { name: 'Club Settings', icon: Building, href: '/dashboard/club', show: isClubManager },
  ].filter(item => item.show);

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#0F172A] border-r border-white/5">
      <div className="p-8 flex items-center gap-4">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
          <Zap className="text-white h-6 w-6" />
        </div>
        <span className="font-headline font-bold text-xl text-white uppercase tracking-tighter">Console</span>
      </div>
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-1 py-2">
          <p className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] opacity-40">{isAdmin ? 'Platform Admin' : 'Management'}</p>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(
                'group flex items-center rounded-2xl px-4 py-4 text-sm font-bold transition-all duration-300',
                pathname === item.href 
                  ? 'bg-primary/20 text-primary border border-primary/20 shadow-inner' 
                  : 'text-muted-foreground hover:bg-white/5 hover:text-white'
              )}
            >
              <item.icon className={cn("mr-3 h-5 w-5 transition-transform group-hover:scale-110", pathname === item.href ? "text-primary" : "opacity-50")} />
              {item.name}
            </Link>
          ))}
        </div>
      </ScrollArea>
      <div className="p-6 border-t border-white/5 bg-black/10">
        <div className="flex items-center gap-4 p-4 bg-white/5 rounded-3xl mb-4 border border-white/5 backdrop-blur-sm">
          <div className="w-11 h-11 rounded-2xl bg-primary/20 flex items-center justify-center text-sm font-bold text-primary border border-primary/20">
            {profile?.displayName?.charAt(0) || user.email?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate text-white">{profile?.displayName || 'User'}</p>
            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">{profile?.role?.replace('_', ' ') || 'Member'}</p>
          </div>
        </div>
        <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-12 rounded-2xl font-bold text-xs uppercase tracking-widest" onClick={handleSignOut}>
          <LogOut className="mr-3 h-4 w-4" /> Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#0F172A]">
      {/* Desktop Sidebar */}
      <aside className="w-72 hidden lg:flex flex-col">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-background/50 relative">
        {/* Mobile & Tablet Header */}
        <header className="lg:hidden flex items-center justify-between p-5 border-b border-white/5 bg-card/50 sticky top-0 z-50 backdrop-blur-xl">
          <div className="flex items-center gap-4">
             {pathname !== '/dashboard' && (
               <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10 rounded-xl bg-white/5">
                 <ChevronLeft className="h-5 w-5" />
               </Button>
             )}
             <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
               <Zap className="text-white h-5 w-5" />
             </div>
             <span className="font-headline font-bold text-xs uppercase tracking-tighter text-white">Tournament Hub</span>
          </div>
          
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white h-10 w-10 rounded-xl bg-white/5">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 bg-[#0F172A] border-r border-white/10 w-72">
               <SheetHeader className="sr-only">
                  <SheetTitle>Navigation Menu</SheetTitle>
                  <SheetDescription>Mobile navigation drawer for dashboard controls.</SheetDescription>
               </SheetHeader>
               <SidebarContent />
            </SheetContent>
          </Sheet>
        </header>

        <div className="container max-w-7xl mx-auto p-6 md:p-12 lg:p-16">
          {children}
        </div>
      </main>
    </div>
  );
}
