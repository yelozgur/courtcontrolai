
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar, Users, Zap, ShieldCheck, Heart, Loader2, Monitor, Building, Sparkles } from 'lucide-react';
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
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.3)]">
            <Zap className="text-white h-5 w-5" />
          </div>
          <span className="font-headline font-bold text-xl tracking-tighter uppercase">Court Control AI</span>
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
              <Button asChild variant="outline" size="sm" className="rounded-xl border-primary/20">
                <Link href="/dashboard" className="flex items-center gap-2">
                  {isAdmin && <ShieldCheck className="h-4 w-4 text-accent" />}
                  {isAdmin ? 'Admin Console' : 'Dashboard'}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign In</Link>
              </Button>
              <Button asChild variant="default" size="sm" className="bg-primary text-primary-foreground hidden md:flex rounded-xl">
                <Link href="/signup">Register Club</Link>
              </Button>
            </div>
          )}
        </nav>
      </header>

      <main className="flex-1">
        <section className="w-full py-20 md:py-32 lg:py-48 relative overflow-hidden">
          {heroImage && (
            <div className="absolute inset-0 z-0">
               <Image 
                src={heroImage.imageUrl} 
                alt="Sports Arena" 
                fill 
                priority 
                className="object-cover opacity-20 pointer-events-none scale-105"
                sizes="100vw"
                data-ai-hint="sports tournament"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-[#0F172A]/0 via-[#0F172A]/50 to-[#0F172A]"></div>
            </div>
          )}
          <div className="container px-4 md:px-6 relative z-10 mx-auto">
            <div className="flex flex-col items-center space-y-6 text-center">
              <div className="space-y-4">
                <Badge variant="outline" className="text-accent border-accent/40 bg-accent/5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-[0.2em] animate-in fade-in slide-in-from-top-4 duration-1000">
                  {isAdmin ? 'SaaS Network Administrator' : 'The Multi-Tenant Sports Engine'}
                </Badge>
                <h1 className="text-5xl font-headline font-bold tracking-tighter sm:text-6xl md:text-7xl lg:text-9xl/none uppercase">
                  Dominate Your <span className="text-primary drop-shadow-[0_0_30px_rgba(139,92,246,0.3)]">Arena</span>
                </h1>
                <p className="mx-auto max-w-[800px] text-muted-foreground md:text-xl lg:text-2xl leading-relaxed font-medium">
                  The elite sports management hub. Automate complex schedules with Genkit AI, broadcast live scores, and grow your player community.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl mt-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                <Button asChild size="lg" className="h-20 text-lg font-bold flex flex-col items-center gap-1 rounded-2xl group transition-all hover:scale-105">
                  <Link href="/tournaments">
                    <Trophy className="h-6 w-6 group-hover:animate-bounce" />
                    <span>Browse Events</span>
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="lg" className="h-20 text-lg font-bold flex flex-col items-center gap-1 rounded-2xl group transition-all hover:scale-105 border border-white/5">
                  <Link href="/arena">
                    <Monitor className="h-6 w-6 text-accent group-hover:scale-110" />
                    <span>Live Arena Hub</span>
                  </Link>
                </Button>
                
                {isAdmin ? (
                  <Button asChild variant="outline" size="lg" className="h-20 text-lg font-bold border-accent/30 text-accent hover:bg-accent/10 flex flex-col items-center gap-1 rounded-2xl group transition-all hover:scale-105">
                    <Link href="/dashboard/admin/clubs">
                      <Building className="h-6 w-6 group-hover:rotate-12" />
                      <span>Manage Network</span>
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="lg" className="h-20 text-lg font-bold border-primary/30 text-primary hover:bg-primary/10 flex flex-col items-center gap-1 rounded-2xl group transition-all hover:scale-105">
                    <Link href={user ? "/dashboard" : "/signup"}>
                      <Zap className="h-6 w-6 group-hover:text-amber-400" />
                      <span>{user ? "Go to Console" : "Launch Your Club"}</span>
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="w-full py-24 bg-card/50 border-y border-white/5">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid gap-12 lg:grid-cols-3">
              <div className="flex flex-col items-center space-y-4 text-center p-8 bg-secondary/20 rounded-[2.5rem] border border-white/5 backdrop-blur-sm transition-all hover:border-primary/30 group">
                <div className="p-5 bg-primary/10 rounded-2xl group-hover:scale-110 transition-transform">
                  <Sparkles className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-2xl font-headline font-bold uppercase tracking-tight">AI Scheduling</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Eliminate manual planning. Our Tournament Director AI handles court allocations and recovery times with Genkit intelligence.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center p-8 bg-secondary/20 rounded-[2.5rem] border border-white/5 backdrop-blur-sm transition-all hover:border-accent/30 group">
                <div className="p-5 bg-accent/10 rounded-2xl group-hover:scale-110 transition-transform">
                  <Monitor className="h-10 w-10 text-accent" />
                </div>
                <h3 className="text-2xl font-headline font-bold uppercase tracking-tight">Arena Broadcast</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Broadcast live scores to stadium screens and guest mobile devices in real-time. Professional results for any club level.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center p-8 bg-secondary/20 rounded-[2.5rem] border border-white/5 backdrop-blur-sm transition-all hover:border-primary/30 group">
                <div className="p-5 bg-primary/10 rounded-2xl group-hover:scale-110 transition-transform">
                  <Users className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-2xl font-headline font-bold uppercase tracking-tight">Player Circuit</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Build a community with global rankings, automated check-ins, and personalized player profiles across the entire network.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 bg-card py-16 md:px-8">
        <div className="container flex flex-col items-center justify-between gap-10 md:flex-row mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
               <Zap className="h-6 w-6 text-primary" />
            </div>
            <p className="text-center text-sm leading-loose text-muted-foreground md:text-left font-medium opacity-60">
              &copy; 2024 Court Control AI. The professional sports management infrastructure.
            </p>
          </div>
          <div className="flex items-center gap-8 text-xs font-bold text-muted-foreground uppercase tracking-widest">
            <Link href="/sponsors" className="flex items-center gap-2 hover:text-primary transition-colors">
              <Heart className="h-4 w-4 text-destructive" /> Partners
            </Link>
            <Link href="/arena" className="hover:text-primary transition-colors">Arena Feed</Link>
            <Link href="/login" className="hover:text-primary transition-colors">Admin Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
