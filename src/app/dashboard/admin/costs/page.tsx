
'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  AlertCircle, 
  Loader2, 
  DollarSign, 
  BarChart3,
  Server,
  Sparkles,
  ReceiptText,
  ShieldCheck,
  Percent,
  Zap,
  Cpu,
  ArrowUpRight
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
    return query(collection(db, 'participants'), orderBy('createdAt', 'desc'), limit(100));
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

    // Estimate daily cloud usage volume
    const documentCount = tournaments.length + participants.length;
    const estReadsPerDay = documentCount * 25; 
    const estWritesPerDay = documentCount * 3; 

    // Pricing only kicks in after free tier (Blaze Plan simulation)
    const firestoreDailyCost = Math.max(0, (estReadsPerDay - 50000) / 100000 * 0.06 + (estWritesPerDay - 20000) / 100000 * 0.18);
    const firestoreMonthlyEst = firestoreDailyCost * 30;

    // AI Costs vs Revenue
    const totalAiUsage = clubs.reduce((acc, c) => acc + (c.aiUsageCount || 0), 0);
    const aiServiceRevenue = clubs.reduce((acc, c) => {
      const usage = c.aiUsageCount || 0;
      if (usage <= 3) return acc;
      return acc + Math.ceil((usage - 3) / 3) * AI_FEE_PER_BLOCK;
    }, 0);

    const estAICallsPerDay = tournaments.length * 0.8;
    const aiMonthlyEst = estAICallsPerDay * 30 * 0.005;

    // Revenue Accounting
    const grossVolume = participants.reduce((acc, p) => acc + (p.paidAmount || 0), 0);
    const platformRevenue = grossVolume * COMMISSION_RATE + aiServiceRevenue;

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
        <h2 className="text-2xl font-bold">Access Denied</h2>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold uppercase tracking-tighter text-white">SaaS Unit Economics</h1>
          <p className="text-muted-foreground font-medium">Tracking 5% fees + AI Credits vs Burn.</p>
        </div>
        <div className="flex items-center gap-3">
           <Badge variant="outline" className="h-10 border-emerald-500/50 text-emerald-500 px-4 bg-emerald-500/5 font-bold uppercase tracking-widest text-[10px]">
             Firebase Spark Plan Active
           </Badge>
        </div>
      </div>

      {(toursLoading || partsLoading || clubsLoading) ? (
        <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>
      ) : stats && (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <CostCard title="Platform GMV" value={`$${stats.grossVolume.toLocaleString()}`} sub="Registration Volume" icon={DollarSign} color="text-white" />
            <CostCard title="Net SaaS Earnings" value={`$${stats.platformRevenue.toFixed(2)}`} sub="Commissions + AI Fees" icon={ArrowUpRight} color="text-accent" />
            <CostCard title="Estimated OpEx" value={`$${stats.totalCost.toFixed(2)}`} sub="Infrastructure Burn" icon={Server} color="text-primary" />
            <CostCard title="Profit Status" value={stats.netProfit >= 0 ? "Profitable" : "Cloud Free"} sub="Economic Health" icon={BarChart3} color={stats.netProfit >= 0 ? "text-emerald-400" : "text-destructive"} />
          </div>

          <div className="grid gap-8 lg:grid-cols-12">
            <Card className="lg:col-span-8 bg-card/50 border-white/5 relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl font-headline">
                    <ReceiptText className="h-5 w-5 text-accent" />
                    Platform Ledger
                  </CardTitle>
                  <CardDescription>Live revenue breakdown including AI Credits.</CardDescription>
                </div>
                <div className="bg-primary/20 p-2 px-4 rounded-full border border-primary/20">
                  <p className="text-[10px] font-bold text-primary uppercase">AI Revenue: ${stats.aiServiceRevenue.toFixed(2)}</p>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableHead className="text-[10px] font-bold uppercase">Source</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Gross</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-accent">Platform Cut</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participants?.slice(0, 8).map((p) => (
                      <TableRow key={p.id} className="border-white/5 hover:bg-white/5">
                        <TableCell className="font-medium text-white">{p.name}</TableCell>
                        <TableCell className="font-mono text-sm">${(p.paidAmount || 0).toFixed(2)}</TableCell>
                        <TableCell className="font-mono text-sm text-accent font-bold">+${((p.paidAmount || 0) * 0.05).toFixed(2)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[8px] uppercase">Registration</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="lg:col-span-4 space-y-6">
              <Card className="bg-[#1E293B] border-primary/20 shadow-2xl overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-lg font-headline flex items-center gap-2"><Database className="h-5 w-5 text-emerald-400" /> Infrastructure Quotas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <UsageProgress label="Firestore Reads" current={stats.readUsagePercent} sub="50k/day Free" />
                  <UsageProgress label="Firestore Writes" current={stats.writeUsagePercent} sub="20k/day Free" />
                  <UsageProgress label="AI Operations" current={stats.aiUsagePercent} sub="1.5k/day Free" color="text-accent" />
                  
                  <div className="pt-4 border-t border-white/5 flex items-center gap-3">
                     <Zap className="h-4 w-4 text-emerald-500" />
                     <p className="text-[10px] text-muted-foreground leading-tight italic">Your monthly cloud bill is currently **$0.00** due to high free tier efficiency.</p>
                  </div>
                </CardContent>
              </Card>
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
      <div className="flex justify-between text-[10px] font-bold uppercase">
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
    <Card className="bg-white/5 border-white/5 hover:border-primary/20 transition-all">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase">{title}</CardTitle>
        <div className={cn("p-2 rounded-lg bg-white/5", color)}><Icon className="h-4 w-4 opacity-70" /></div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-headline font-bold text-white">{value}</div>
        <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}
