'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  AlertCircle, 
  Loader2, 
  DollarSign, 
  Server, 
  Sparkles, 
  ReceiptText, 
  ShieldCheck, 
  Zap, 
  TrendingUp, 
  Activity 
} from 'lucide-react';
import { collection, query, limit, orderBy, doc } from 'firebase/firestore';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export default function AdminCostDashboard() {
  const db = useFirestore();
  const { user } = useUser();

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);
  
  const { data: profile } = useDoc(userProfileRef);
  const isAdmin = profile?.role === 'admin' || user?.email?.toLowerCase() === 'admin@deneme.com';

  const tournamentsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'tournaments'), limit(1000));
  }, [db]);

  const participantsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'participants'), orderBy('createdAt', 'desc'), limit(1000));
  }, [db]);

  const clubsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'clubs'), limit(1000));
  }, [db]);

  const { data: tournaments, loading: toursLoading } = useCollection(tournamentsQuery);
  const { data: participants, loading: partsLoading } = useCollection(participantsQuery);
  const { data: clubs, loading: clubsLoading } = useCollection(clubsQuery);

  const stats = useMemo(() => {
    if (!tournaments || !participants || !clubs) return null;

    const COMMISSION_RATE = 0.05; // 5% SaaS Platform Fee
    const AI_FEE_PER_BLOCK = 5.00;

    // SaaS Global Analytics
    const documentCount = tournaments.length + participants.length;
    const estReadsPerDay = documentCount * 25; 
    const estWritesPerDay = documentCount * 3; 

    const firestoreDailyCost = Math.max(0, (estReadsPerDay - 50000) / 100000 * 0.06 + (estWritesPerDay - 20000) / 100000 * 0.18);
    const firestoreMonthlyEst = firestoreDailyCost * 30;

    // Platform-wide AI Revenue Accounting
    const aiServiceRevenue = clubs.reduce((acc, c) => {
      const usage = c.aiUsageCount || 0;
      if (usage <= 3) return acc;
      return acc + Math.floor((usage - 1) / 3) * AI_FEE_PER_BLOCK;
    }, 0);

    const estAICallsPerDay = tournaments.length * 0.5;
    const aiMonthlyEst = estAICallsPerDay * 30 * 0.002;

    // Platform SaaS Profit vs Global Volume
    const grossVolume = participants.reduce((acc, p) => acc + (p.paidAmount || 0), 0);
    const platformRevenue = (grossVolume * COMMISSION_RATE) + aiServiceRevenue;

    return {
      documentCount,
      firestoreMonthlyEst,
      aiMonthlyEst,
      aiServiceRevenue,
      totalCost: firestoreMonthlyEst + aiMonthlyEst,
      grossVolume,
      platformRevenue,
      commissionRate: COMMISSION_RATE * 100,
      netProfit: platformRevenue - (firestoreMonthlyEst + aiMonthlyEst),
      readUsagePercent: Math.min(100, (estReadsPerDay / 50000) * 100),
      writeUsagePercent: Math.min(100, (estWritesPerDay / 20000) * 100),
      aiUsagePercent: Math.min(100, (estAICallsPerDay / 1500) * 100)
    };
  }, [tournaments, participants, clubs]);

  if (!isAdmin && !toursLoading && !partsLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-2xl font-bold uppercase tracking-tighter">Access Denied</h2>
        <p className="text-muted-foreground">Only platform administrators can view economic metrics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold uppercase tracking-tighter text-white">Platform Economics</h1>
          <p className="text-muted-foreground font-medium">Tracking global commissions + AI credits vs burn.</p>
        </div>
        <div className="flex items-center gap-3">
           <Badge variant="outline" className="h-10 border-emerald-500/30 text-emerald-500 px-4 bg-emerald-500/5 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
             <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
             Global SaaS Live
           </Badge>
        </div>
      </div>

      {(toursLoading || partsLoading || clubsLoading) ? (
        <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>
      ) : stats && (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <CostCard title="Global Network GMV" value={`$${stats.grossVolume.toLocaleString()}`} sub="Total Platform Volume" icon={DollarSign} color="text-white" />
            <CostCard title="SaaS Commission (5%)" value={`$${(stats.grossVolume * 0.05).toFixed(2)}`} sub="Platform Net Revenue" icon={TrendingUp} color="text-accent" />
            <CostCard title="Global Infrastructure" value={`$${stats.totalCost.toFixed(2)}`} sub="Monthly burn estimate" icon={Server} color="text-primary" />
            <CostCard title="AI Service Profit" value={`$${stats.aiServiceRevenue.toFixed(2)}`} sub="Credit block revenue" icon={ShieldCheck} color="text-emerald-400" />
          </div>

          <div className="grid gap-8 lg:grid-cols-12">
            <Card className="lg:col-span-8 bg-card/50 border-white/5 relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl font-headline uppercase tracking-tight">
                    <ReceiptText className="h-5 w-5 text-accent" />
                    Global Transaction Log
                  </CardTitle>
                  <CardDescription>Consolidated platform revenue stream tracking.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Club / Player</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Gross Fee</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-accent">SaaS Cut (5%)</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participants?.slice(0, 15).map((p) => (
                      <TableRow key={p.id} className="border-white/5 hover:bg-white/5 transition-colors">
                        <TableCell className="font-bold text-white">
                          <div className="flex flex-col">
                            <span className="text-[9px] uppercase text-muted-foreground opacity-60">ID: {p.id.slice(-8)}</span>
                            <span>{p.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">${(p.paidAmount || 0).toFixed(2)}</TableCell>
                        <TableCell className="font-mono text-sm text-accent font-bold">+${((p.paidAmount || 0) * 0.05).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[8px] uppercase tracking-widest border-none bg-emerald-500/10 text-emerald-500">PROCESSED</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="lg:col-span-4 space-y-6">
              <Card className="bg-[#1E293B] border-primary/20 shadow-2xl overflow-hidden">
                <CardHeader className="bg-primary/5 border-b border-white/5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-headline uppercase tracking-tighter flex items-center gap-2">
                      <Database className="h-5 w-5 text-emerald-400" /> 
                      Network Utilization
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <UsageProgress label="Total Storage Reads" current={stats.readUsagePercent} sub="Across all tenants" />
                  <UsageProgress label="Total Storage Writes" current={stats.writeUsagePercent} sub="Across all tenants" />
                  <UsageProgress label="AI Genkit Load" current={stats.aiUsagePercent} sub="Capacity used" color="text-accent" />
                  
                  <div className="pt-4 border-t border-white/5 flex items-center gap-3">
                     <Zap className="h-4 w-4 text-emerald-500" />
                     <p className="text-[10px] text-muted-foreground leading-tight italic">Platform is currently 100% cloud efficient (Tier 1 Status).</p>
                  </div>
                </CardContent>
              </Card>

              <div className="bg-accent/5 border border-accent/20 p-6 rounded-3xl relative overflow-hidden group">
                  <Sparkles className="absolute -right-4 -top-4 h-24 w-24 text-accent opacity-5 group-hover:scale-125 transition-transform" />
                  <h3 className="font-headline font-bold text-accent mb-2 flex items-center gap-2 uppercase tracking-tighter">SaaS Insight</h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    You are viewing GLOBAL network health. These metrics are the aggregate of all sports organizations. Individual club performance is strictly isolated to the organization owners.
                  </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function UsageProgress({ label, current, sub, color }: any) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("text-white", color)}>{current.toFixed(1)}%</span>
      </div>
      <Progress value={current} className="h-1.5 bg-white/5" />
      <p className="text-[8px] text-muted-foreground text-right">{sub}</p>
    </div>
  );
}

function CostCard({ title, value, sub, icon: Icon, color }: any) {
  return (
    <Card className="bg-card/50 border-white/5 hover:border-primary/20 transition-all overflow-hidden group">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{title}</CardTitle>
        <div className={cn("p-2 rounded-lg bg-white/5 group-hover:scale-110 transition-transform", color)}><Icon className="h-4 w-4 opacity-70" /></div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-headline font-bold text-white tracking-tight">{value}</div>
        <p className="text-[10px] text-muted-foreground mt-1 uppercase font-medium">{sub}</p>
      </CardContent>
    </Card>
  );
}
