
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar, Users, Zap, ShieldCheck, LayoutDashboard } from 'lucide-react';

export default function HomePage() {
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
          <Link className="text-sm font-medium hover:text-primary transition-colors" href="/dashboard">
            Dashboard
          </Link>
          <Link className="text-sm font-medium hover:text-primary transition-colors" href="/referee">
            Referee
          </Link>
          <Link className="text-sm font-medium hover:text-primary transition-colors" href="/arena">
            Arena View
          </Link>
          <Button asChild variant="default" className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Link href="/dashboard">Get Started</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-[url('https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=2069&auto=format&fit=crop')] bg-cover bg-center relative overflow-hidden">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px]"></div>
          <div className="container px-4 md:px-6 relative z-10 mx-auto">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <Badge variant="outline" className="text-accent border-accent px-4 py-1 rounded-full text-sm font-bold uppercase tracking-widest">
                  AI-Powered Tournament Engine
                </Badge>
                <h1 className="text-3xl font-headline font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-7xl/none">
                  Ultimate Precision <br/> For Every <span className="text-primary">Tournament</span>
                </h1>
                <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
                  Automate scheduling, manage participants, and provide real-time updates with CourtControl AI. The world's first OR-Tools optimized tournament wizard.
                </p>
              </div>
              <div className="space-x-4">
                <Button size="lg" className="h-12 px-8 font-bold">
                  Start New Tournament
                </Button>
                <Button variant="outline" size="lg" className="h-12 px-8 border-primary text-primary hover:bg-primary/10">
                  View Demo
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full py-12 md:py-24 lg:py-32 bg-card">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid gap-12 lg:grid-cols-3">
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="p-4 bg-primary/10 rounded-2xl">
                  <Calendar className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-headline font-bold">Smart Scheduling</h3>
                <p className="text-muted-foreground">
                  Our OR-Tools engine builds conflict-free schedules based on court availability and player rest times automatically.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="p-4 bg-accent/10 rounded-2xl">
                  <ShieldCheck className="h-10 w-10 text-accent" />
                </div>
                <h3 className="text-xl font-headline font-bold">Verified Results</h3>
                <p className="text-muted-foreground">
                  Real-time referee scoring with mandatory player approval via Telegram ensures zero-friction result accuracy.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="p-4 bg-primary/10 rounded-2xl">
                  <Users className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-headline font-bold">Player Experience</h3>
                <p className="text-muted-foreground">
                  Personal stats hubs, automated match notifications, and digital check-ins keep players engaged and informed.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card py-6 md:px-8 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row mx-auto">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built by CourtControl AI. The future of sports tournament management.
          </p>
          <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
            <Link href="#" className="underline underline-offset-4">Terms</Link>
            <Link href="#" className="underline underline-offset-4">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
