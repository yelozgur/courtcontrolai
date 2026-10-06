'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Compass, Home, Trophy, Zap } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] p-4">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg">
          <Zap className="text-white h-6 w-6" />
        </div>
        <span className="text-2xl font-headline font-bold text-white tracking-tighter uppercase">CourtControl AI</span>
      </Link>

      <Card className="w-full max-w-lg border-white/5 bg-card/50 backdrop-blur-xl">
        <CardHeader className="text-center space-y-3">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/20">
            <Compass className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-5xl font-headline font-bold text-white tracking-tighter">404</CardTitle>
          <CardDescription className="text-base">
            Aradığınız sayfa bulunamadı. — This page could not be found.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg" className="font-bold">
            <Link href="/">
              <Home className="h-4 w-4" />
              Ana sayfa
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold">
            <Link href="/tournaments">
              <Trophy className="h-4 w-4 text-amber-400" />
              Turnuvalar
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
