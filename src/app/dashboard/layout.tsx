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
  ChevronLeft,
  Search,
  Bell,
  SearchIcon
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUser, useAuth, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { LocaleSwitcher } from '@/i18n/LocaleSwitcher';
import { useI18n } from '@/i18n/I18nProvider';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from '@/components/ui/input';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading: authLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { t } = useI18n();

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);
  
  const { data: profile, loading: profileLoading } = useDoc(userProfileRef);

  const isAdmin = profile?.role === 'admin';

  const handleSignOut = () => {
    setIsMobileMenuOpen(false);
    signOut(auth).then(() => router.push('/'));
  };

  if (authLoading || (user && profileLoading)) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse text-xs uppercase tracking-widest font-bold">Syncing Console...</p>
      </div>
    );
  }

  if (!user) return null;

  const navItems = isAdmin ? [
    { name: 'Platform Admin', icon: ShieldCheck, href: '/dashboard' },
    { name: 'Marketing', icon: Megaphone, href: '/dashboard/admin/marketing' },
    { name: 'Clubs Registry', icon: Building, href: '/dashboard/admin/clubs' },
    { name: 'User Accounts', icon: Users2, href: '/dashboard/admin/users' },
    { name: 'Economics', icon: Calculator, href: '/dashboard/admin/costs' },
  ] : [
    { name: t('nav.console'), icon: LayoutDashboard, href: '/dashboard' },
    { name: t('nav.tournaments'), icon: Trophy, href: '/dashboard/tournaments' },
    { name: t('nav.matchPlanner'), icon: Calendar, href: '/dashboard/schedule' },
    { name: t('nav.clubRoster'), icon: Users, href: '/dashboard/participants' },
    { name: t('nav.venueArrival'), icon: QrCode, href: '/dashboard/check-in' },
    { name: t('nav.partners'), icon: Heart, href: '/dashboard/sponsors' },
    { name: t('nav.settings'), icon: Building, href: '/dashboard/club' },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-card border-r border-border">
      <div className="p-8 flex items-center gap-3">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
          <Zap className="text-white h-6 w-6" />
        </div>
        <div>
          <span className="font-headline font-bold text-lg leading-tight block">CourtControl</span>
          <span className="text-[10px] text-primary font-bold uppercase tracking-widest leading-none">Management AI</span>
        </div>
      </div>
      
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-1 py-4">
          <p className="px-4 pb-3 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] opacity-50">{t('nav.mainMenu')}</p>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(
                'group flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200',
                pathname === item.href 
                  ? 'bg-primary text-primary-foreground shadow-md' 
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <item.icon className={cn("mr-3 h-5 w-5", pathname === item.href ? "text-primary-foreground" : "opacity-70 group-hover:opacity-100")} />
              {item.name}
            </Link>
          ))}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border bg-muted/20">
        <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-2xl">
          <Avatar className="h-10 w-10 border-2 border-primary/20">
            <AvatarImage src={profile?.photoURL} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold">{profile?.displayName?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold truncate leading-none mb-1">{profile?.displayName || 'Club Manager'}</p>
            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">{profile?.role?.replace('_', ' ') || 'Member'}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="w-72 hidden lg:flex flex-col">
        <SidebarContent />
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Global Header */}
        <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
             <div className="lg:hidden">
               <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                 <SheetTrigger asChild>
                   <Button variant="ghost" size="icon" className="h-10 w-10">
                     <Menu className="h-6 w-6" />
                   </Button>
                 </SheetTrigger>
                 <SheetContent side="left" className="p-0 border-r-0 w-72">
                    <SheetHeader className="sr-only">
                      <SheetTitle>Navigation Menu</SheetTitle>
                      <SheetDescription>Access dashboard management links and tools.</SheetDescription>
                    </SheetHeader>
                    <SidebarContent />
                 </SheetContent>
               </Sheet>
             </div>
             
             <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
               <LayoutDashboard className="h-4 w-4" />
               <span className="hidden md:block">Dashboard</span>
               <span className="mx-2 hidden md:block">/</span>
               <span className="text-foreground font-bold capitalize">{pathname.split('/').pop() || 'Overview'}</span>
             </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="relative hidden md:block w-64">
               <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
               <Input placeholder="Search anything (⌘K)" className="pl-9 h-9 bg-secondary/50 border-transparent focus:bg-background transition-all rounded-full" />
             </div>
             <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full relative">
               <Bell className="h-5 w-5" />
               <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full ring-2 ring-background"></span>
             </Button>
             
              <LocaleSwitcher />

              <DropdownMenu>
                 <DropdownMenuTrigger asChild>
                   <Button variant="ghost" className="p-1 h-9 rounded-full gap-2 pr-3 hover:bg-secondary">
                     <Avatar className="h-7 w-7">
                       <AvatarImage src={profile?.photoURL} />
                       <AvatarFallback className="text-[10px]">{profile?.displayName?.charAt(0)}</AvatarFallback>
                     </Avatar>
                     <span className="text-xs font-bold hidden sm:inline-block">Account</span>
                   </Button>
                 </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{t('profile.myAccount')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/dashboard/profile')}>{t('profile.profileSettings')}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/dashboard/club')}>{t('profile.clubIdentity')}</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">{t('profile.logOut')}</DropdownMenuItem>
                </DropdownMenuContent>
             </DropdownMenu>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 overflow-y-auto page-transition p-6 md:p-10">
          <div className="container max-w-6xl mx-auto space-y-10">
            {children}
          </div>
        </main>

        {/* Mobile Tab Bar */}
        <div className="lg:hidden border-t border-border bg-card flex justify-around p-3 pb-safe-offset-2">
           <Link href="/dashboard" className={cn("p-2 rounded-xl flex flex-col items-center gap-1", pathname === '/dashboard' ? 'text-primary' : 'text-muted-foreground')}>
             <LayoutDashboard className="h-5 w-5" />
             <span className="text-[9px] font-bold uppercase tracking-widest">Home</span>
           </Link>
           <Link href="/dashboard/tournaments" className={cn("p-2 rounded-xl flex flex-col items-center gap-1", pathname.includes('tournaments') ? 'text-primary' : 'text-muted-foreground')}>
             <Trophy className="h-5 w-5" />
             <span className="text-[9px] font-bold uppercase tracking-widest">Events</span>
           </Link>
           <Link href="/dashboard/schedule" className={cn("p-2 rounded-xl flex flex-col items-center gap-1", pathname.includes('schedule') ? 'text-primary' : 'text-muted-foreground')}>
             <Calendar className="h-5 w-5" />
             <span className="text-[9px] font-bold uppercase tracking-widest">Plan</span>
           </Link>
           <Link href="/dashboard/profile" className={cn("p-2 rounded-xl flex flex-col items-center gap-1", pathname.includes('profile') ? 'text-primary' : 'text-muted-foreground')}>
             <User className="h-5 w-5" />
             <span className="text-[9px] font-bold uppercase tracking-widest">Me</span>
           </Link>
        </div>
      </div>
    </div>
  );
}