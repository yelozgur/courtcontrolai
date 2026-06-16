
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar, Users, Zap, ShieldCheck, Heart, Loader2, Play, Monitor, Building } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

export default function HomePage() {
  const { user, loading } = useUser();
  const db = useFirestore();
  const heroImage = PlaceHolderImages.find(img => img.id === 'hero-tournament');

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);
  
  const { data: profile } = useDoc(userProfileRef);
  const isAdmin = profile?.role === 'admin';

  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-16 flex items-center border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <Link className="flex items-center justify-center space-x-2" href="/">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Zap className="text-primary-foreground h-5 w-5" />
          </div>
          <span className="font-headline font-bold text-xl tracking-tighter">CourtControl AI</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6 items-center">
          <Link className="text-sm font-medium hover:text-primary transition-colors hidden sm:block" href="/tournaments">
            Events
          </Link>
          <Link className="text-sm font-medium hover:text-primary transition-colors hidden sm:block" href="/arena">
            Arena
          </Link>
          
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : user ? (
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard" className="flex items-center gap-2">
                  {isAdmin && <ShieldCheck className="h-4 w-4 text-accent" />}
                  {isAdmin ? 'Admin Panel' : 'Dashboard'}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign In</Link>
              </Button>
              <Button asChild variant="default" size="sm" className="bg-primary text-primary-foreground hidden md:flex">
                <Link href="/signup">Register</Link>
              </Button>
            </div>
          )}
        </nav>
      </header>

      <main className="flex-1">
        <section 
          className="w-full py-20 md:py-32 lg:py-48 bg-cover bg-center relative overflow-hidden"
          style={{ backgroundImage: `url('${heroImage?.imageUrl}')` }}
          data-ai-hint="sports tournament"
        >
          <div className="absolute inset-0 bg-background/85 backdrop-blur-[1px]"></div>
          <div className="container px-4 md:px-6 relative z-10 mx-auto">
            <div className="flex flex-col items-center space-y-6 text-center">
              <div className="space-y-4">
                <Badge variant="outline" className="text-accent border-accent px-4 py-1 rounded-full text-sm font-bold uppercase tracking-widest">
                  {isAdmin ? 'Logged in as SaaS Administrator' : 'The Multi-Tenant Sports SaaS'}
                </Badge>
                <h1 className="text-4xl font-headline font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-8xl/none">
                  Choose Your <span className="text-primary">Arena</span>
                </h1>
                <p className="mx-auto max-w-[800px] text-muted-foreground md:text-xl lg:text-2xl leading-relaxed">
                  Manage your club, host elite tournaments, or find your next competition. <br className="hidden md:block" /> AI-powered scheduling and real-time live results for every court.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl mt-8">
                <Button asChild size="lg" className="h-16 text-lg font-bold flex flex-col items-center gap-1">
                  <Link href="/tournaments">
                    <Trophy className="h-5 w-5" />
                    Find Tournaments
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="lg" className="h-16 text-lg font-bold flex flex-col items-center gap-1">
                  <Link href="/arena">
                    <Monitor className="h-5 w-5" />
                    Enter Live Arena
                  </Link>
                </Button>
                
                {isAdmin ? (
                  <Button asChild variant="outline" size="lg" className="h-16 text-lg font-bold border-accent text-accent hover:bg-accent/10 flex flex-col items-center gap-1">
                    <Link href="/dashboard/admin/clubs">
                      <Building className="h-5 w-5" />
                      Manage All Clubs
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="lg" className="h-16 text-lg font-bold border-primary text-primary hover:bg-primary/10 flex flex-col items-center gap-1">
                    <Link href={user ? "/dashboard" : "/signup"}>
                      <Zap className="h-5 w-5" />
                      {user ? "Go to Dashboard" : "Register Your Club"}
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="w-full py-16 bg-card border-y border-border">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid gap-12 lg:grid-cols-3">
              <div className="flex flex-col items-center space-y-4 text-center p-6 bg-secondary/20 rounded-3xl border border-white/5">
                <div className="p-4 bg-primary/10 rounded-2xl">
                  <Calendar className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-headline font-bold">Smart Scheduling</h3>
                <p className="text-muted-foreground">
                  Our AI scheduler handles court allocations and match timing automatically.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center p-6 bg-secondary/20 rounded-3xl border border-white/5">
                <div className="p-4 bg-accent/10 rounded-2xl">
                  <Monitor className="h-10 w-10 text-accent" />
                </div>
                <h3 className="text-xl font-headline font-bold">Live Dashboards</h3>
                <p className="text-muted-foreground">
                  Real-time scoring and brackets for waiting areas and digital stadium screens.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center p-6 bg-secondary/20 rounded-3xl border border-white/5">
                <div className="p-4 bg-primary/10 rounded-2xl">
                  <Users className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-headline font-bold">Member Portal</h3>
                <p className="text-muted-foreground">
                  Unified player profiles and registration across all clubs on the network.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card py-12 md:px-8">
        <div className="container flex flex-col items-center justify-between gap-6 md:h-24 md:flex-row mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <Zap className="h-6 w-6 text-primary" />
            <p className="text-center text-sm leading-loose text-muted-foreground md:text-left font-medium">
              &copy; 2024 CourtControl AI. The elite sports management engine.
            </p>
          </div>
          <div className="flex items-center gap-6 text-sm font-bold text-muted-foreground">
            <Link href="/sponsors" className="flex items-center gap-2 hover:text-primary transition-colors">
              <Heart className="h-4 w-4" /> Partners
            </Link>
            <Link href="/arena" className="hover:text-primary transition-colors">Live Feed</Link>
            <Link href="/login" className="hover:text-primary transition-colors">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
