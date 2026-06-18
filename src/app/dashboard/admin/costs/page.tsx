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
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Percent
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

  const matchesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'matches'), limit(10000));
  }, [db]);

  const { data: tournaments, loading: toursLoading } = useCollection(tournamentsQuery);
  const { data: participants, loading: partsLoading } = useCollection(participantsQuery);
  const { data: matches, loading: matchesLoading } = useCollection(matchesQuery);

  const stats = useMemo(() => {
    if (!tournaments || !participants || !matches) return null;

    const COMMISSION_RATE = 0.05; // 5% SaaS Platform Fee

    // Estimate Firestore Costs (Approximate pricing)
    const documentCount = tournaments.length + participants.length + matches.length;
    const estReadsPerDay = documentCount * 20; 
    const estWritesPerDay = documentCount * 2; 

    const firestoreDailyCost = (estReadsPerDay / 100000) * 0.06 + (estWritesPerDay / 100000) * 0.18;
    const firestoreMonthlyEst = firestoreDailyCost * 30;

    // Estimate Genkit AI Costs
    const estAIFlows = tournaments.length * 2; 
    const aiMonthlyEst = estAIFlows * 0.01;

    // Revenue Accounting
    const grossRevenue = participants.reduce((acc, p) => acc + (p.paidAmount || 0), 0);
    const platformCommission = grossRevenue * COMMISSION_RATE;
    const clubPayouts = grossRevenue * (1 - COMMISSION_RATE);

    return {
      documentCount,
      firestoreMonthlyEst,
      aiMonthlyEst,
      totalCost: firestoreMonthlyEst + aiMonthlyEst + 5, // $5 baseline hosting
      grossRevenue,
      platformCommission,
      clubPayouts,
      commissionRate: COMMISSION_RATE * 100,
      netProfit: platformCommission - (firestoreMonthlyEst + aiMonthlyEst + 5)
    };
  }, [tournaments, participants, matches]);

  if (!isAdmin && !toursLoading && !partsLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground">This dashboard is restricted to Court Control AI Platform Owners.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold uppercase tracking-tighter">SaaS Unit Economics</h1>
          <p className="text-muted-foreground font-medium">Tracking your {stats?.commissionRate || 5}% platform fee against real-time infrastructure burn.</p>
        </div>
        <div className="flex items-center gap-3">
           <Badge variant="outline" className="h-10 border-accent text-accent px-4 bg-accent/5 font-bold uppercase tracking-widest text-[10px]">
             Fee Structure: 5.0%
           </Badge>
           <Badge variant="outline" className="h-10 border-primary text-primary px-4 bg-primary/5 font-bold uppercase tracking-widest text-[10px]">
             Auto-Debit Active
           </Badge>
        </div>
      </div>

      {(toursLoading || partsLoading || matchesLoading) ? (
        <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>
      ) : stats && (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <CostCard 
              title="Platform GMV" 
              value={`$${stats.grossRevenue.toLocaleString()}`} 
              sub="Total Volume Processed" 
              icon={DollarSign} 
              color="text-white"
            />
            <CostCard 
              title="SaaS Revenue (5%)" 
              value={`$${stats.platformCommission.toFixed(2)}`} 
              sub="Direct Platform Earnings" 
              icon={Percent} 
              color="text-accent"
            />
            <CostCard 
              title="Infrastructure OpEx" 
              value={`$${stats.totalCost.toFixed(2)}`} 
              sub="Estimated Cloud Burn" 
              icon={Server} 
              color="text-primary"
            />
            <CostCard 
              title="Net Profit" 
              value={`$${stats.netProfit.toFixed(2)}`} 
              sub="Profit after Platform Costs" 
              icon={BarChart3} 
              color={stats.netProfit > 0 ? "text-emerald-400" : "text-destructive"}
            />
          </div>

          <div className="grid gap-8 lg:grid-cols-12">
            <Card className="lg:col-span-8 bg-card/50 border-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                 <ShieldCheck className="h-32 w-32" />
              </div>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl font-headline">
                    <ReceiptText className="h-5 w-5 text-accent" />
                    Transaction Ledger & Audit
                  </CardTitle>
                  <CardDescription>Live reconciliation of registration fees and platform commissions.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest">Participant</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest">Entry Fee</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-accent">SaaS Cut (5%)</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest">Club Payout</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participants?.slice(0, 10).map((p) => (
                      <TableRow key={p.id} className="border-white/5 hover:bg-white/5 transition-colors">
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span className="text-sm text-white font-bold">{p.name}</span>
                            <span className="text-[9px] text-muted-foreground uppercase">{p.categoryName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-white">
                          ${(p.paidAmount || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-accent font-bold">
                          +${((p.paidAmount || 0) * 0.05).toFixed(2)}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          ${((p.paidAmount || 0) * 0.95).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {participants?.length === 0 && (
                  <div className="py-20 text-center italic text-muted-foreground">No transactions recorded in this period.</div>
                )}
              </CardContent>
            </Card>

            <div className="lg:col-span-4 space-y-6">
              <Card className="bg-[#1E293B] border-primary/20 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/20 transition-all"></div>
                <CardHeader>
                  <CardTitle className="text-lg font-headline">Commission Distribution</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-6 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 shadow-inner">
                     <p className="text-[10px] uppercase font-bold text-emerald-500 mb-1 tracking-widest">Commission Revenue</p>
                     <p className="text-4xl font-headline font-bold text-white">${stats.platformCommission.toFixed(2)}</p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <ArrowUpRight className="h-3 w-3 text-accent" /> Platform Fee (5%)
                      </span>
                      <span className="font-mono text-accent font-bold">{stats.commissionRate}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <ArrowDownLeft className="h-3 w-3 text-primary" /> Club Payout (95%)
                      </span>
                      <span className="font-mono">95.0%</span>
                    </div>
                    <div className="pt-4 border-t border-white/5">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Retention Target</span>
                        <span className="text-[10px] font-mono text-emerald-400">${stats.clubPayouts.toFixed(2)}</span>
                      </div>
                      <Progress value={95} className="h-2 bg-white/5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-white/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" />
                    Infrastructure Burn
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="flex justify-between items-center text-xs">
                     <span className="text-muted-foreground">Database Usage (Estimated)</span>
                     <span className="font-mono">${stats.firestoreMonthlyEst.toFixed(2)}</span>
                   </div>
                   <div className="flex justify-between items-center text-xs">
                     <span className="text-muted-foreground">AI Optimization Tokens</span>
                     <span className="font-mono">${stats.aiMonthlyEst.toFixed(2)}</span>
                   </div>
                   <div className="flex justify-between items-center text-xs">
                     <span className="text-muted-foreground">Baseline Hosting</span>
                     <span className="font-mono">$5.00</span>
                   </div>
                   <div className="pt-3 border-t border-white/10 flex justify-between items-center font-bold text-sm">
                      <span className="uppercase text-[10px] tracking-widest">Total Estimated OpEx</span>
                      <span className="text-destructive font-mono">${stats.totalCost.toFixed(2)}</span>
                   </div>
                </CardContent>
              </Card>

              <div className="bg-accent/5 border border-accent/20 p-6 rounded-3xl">
                 <div className="flex items-center gap-3 mb-2">
                    <Sparkles className="h-4 w-4 text-accent" />
                    <h4 className="text-xs font-bold text-accent uppercase tracking-widest">Growth Forecast</h4>
                 </div>
                 <p className="text-[11px] text-muted-foreground leading-relaxed">
                   Based on current document growth, your break-even point is approximately **$120** in total GMV per month. You are currently at **${stats.grossRevenue.toFixed(0)}**.
                 </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CostCard({ title, value, sub, icon: Icon, color }: any) {
  return (
    <Card className="bg-white/5 border-white/5 group hover:border-primary/20 transition-all shadow-lg hover:shadow-primary/5">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{title}</CardTitle>
        <div className={cn("p-2 rounded-lg bg-white/5 group-hover:scale-110 transition-transform", color)}>
          <Icon className="h-4 w-4 opacity-70 group-hover:opacity-100 transition-opacity" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-headline font-bold tracking-tight">{value}</div>
        <p className="text-[10px] text-muted-foreground mt-1 font-medium">{sub}</p>
      </CardContent>
    </Card>
  );
}
