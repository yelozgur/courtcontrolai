
'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Calculator, 
  Database, 
  Zap, 
  TrendingUp, 
  AlertCircle, 
  Loader2, 
  DollarSign, 
  BarChart3,
  Server,
  Sparkles,
  ReceiptText,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';
import { collection, query, limit, orderBy } from 'firebase/firestore';
import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function AdminCostDashboard() {
  const db = useFirestore();
  const { user } = useUser();

  const userProfileRef = doc(db || {}, 'users', user?.uid || 'none');
  const { data: profile } = useDoc(userProfileRef);
  const isAdmin = profile?.role === 'admin' || user?.email?.toLowerCase() === 'admin@deneme.com';

  const { data: tournaments, loading: toursLoading } = useCollection(
    db ? query(collection(db, 'tournaments'), limit(1000)) : null
  );
  const { data: participants, loading: partsLoading } = useCollection(
    db ? query(collection(db, 'participants'), orderBy('createdAt', 'desc'), limit(100)) : null
  );
  const { data: matches, loading: matchesLoading } = useCollection(
    db ? query(collection(db, 'matches'), limit(10000)) : null
  );

  const stats = useMemo(() => {
    if (!tournaments || !participants || !matches) return null;

    const COMMISSION_RATE = 0.05; // 5% SaaS Commission

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

  if (!isAdmin) {
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
          <h1 className="text-3xl font-headline font-bold uppercase tracking-tighter">SaaS Economics & Accounting</h1>
          <p className="text-muted-foreground font-medium">Tracking your {stats?.commissionRate}% platform commission and infrastructure costs.</p>
        </div>
        <Badge variant="outline" className="h-8 border-primary text-primary px-4 bg-primary/5">
          Rev Share: 5.0%
        </Badge>
      </div>

      {(toursLoading || partsLoading || matchesLoading) ? (
        <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>
      ) : stats && (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <CostCard 
              title="Gross GMV" 
              value={`$${stats.grossRevenue.toLocaleString()}`} 
              sub="Total Volume Processed" 
              icon={DollarSign} 
              color="text-white"
            />
            <CostCard 
              title="Platform Rev" 
              value={`$${stats.platformCommission.toFixed(2)}`} 
              sub="5% Platform Cut" 
              icon={TrendingUp} 
              color="text-accent"
            />
            <CostCard 
              title="Est. Infrastructure" 
              value={`$${stats.totalCost.toFixed(2)}`} 
              sub="Monthly Cloud Burn" 
              icon={Server} 
              color="text-primary"
            />
            <CostCard 
              title="Net Margin" 
              value={`$${stats.netProfit.toFixed(2)}`} 
              sub="Profit after Cloud" 
              icon={BarChart3} 
              color={stats.netProfit > 0 ? "text-emerald-400" : "text-destructive"}
            />
          </div>

          <div className="grid gap-8 lg:grid-cols-12">
            <Card className="lg:col-span-8 bg-card/50 border-white/5">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ReceiptText className="h-5 w-5 text-accent" />
                    Transaction Ledger
                  </CardTitle>
                  <CardDescription>Live audit of recent registrations and commissions.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableHead className="text-[10px] font-bold uppercase">Participant</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Paid (Gross)</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">SaaS Cut (5%)</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Club Payout</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participants?.slice(0, 10).map((p) => (
                      <TableRow key={p.id} className="border-white/5 hover:bg-white/5">
                        <TableCell className="font-medium text-xs">
                          {p.name}
                          <span className="block text-[9px] text-muted-foreground">{p.categoryName}</span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-white">
                          ${(p.paidAmount || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-accent">
                          +${((p.paidAmount || 0) * 0.05).toFixed(2)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          ${((p.paidAmount || 0) * 0.95).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="lg:col-span-4 space-y-6">
              <Card className="bg-[#1E293B] border-primary/20 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-lg">Revenue Distribution</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                     <p className="text-[10px] uppercase font-bold text-emerald-500 mb-1">Commission Earned</p>
                     <p className="text-3xl font-headline font-bold text-white">${stats.platformCommission.toFixed(2)}</p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <ArrowUpRight className="h-3 w-3 text-accent" /> Platform Commission
                      </span>
                      <span className="font-mono text-accent">5%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <ArrowDownLeft className="h-3 w-3 text-primary" /> Club Disbursement
                      </span>
                      <span className="font-mono">95%</span>
                    </div>
                    <div className="pt-4 border-t border-white/5">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Club Retention</span>
                        <span className="text-[10px] font-mono">${stats.clubPayouts.toFixed(2)}</span>
                      </div>
                      <Progress value={95} className="h-1.5 bg-white/5" />
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
                     <span className="text-muted-foreground">Database Activity</span>
                     <span className="font-mono">${stats.firestoreMonthlyEst.toFixed(2)}</span>
                   </div>
                   <div className="flex justify-between items-center text-xs">
                     <span className="text-muted-foreground">AI Optimization</span>
                     <span className="font-mono">${stats.aiMonthlyEst.toFixed(2)}</span>
                   </div>
                   <div className="pt-2 border-t border-white/5 flex justify-between items-center font-bold text-sm">
                      <span>Total OpEx</span>
                      <span className="text-destructive">${stats.totalCost.toFixed(2)}</span>
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

function CostCard({ title, value, sub, icon: Icon, color }: any) {
  return (
    <Card className="bg-white/5 border-white/5 group hover:border-primary/20 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color} opacity-70 group-hover:opacity-100 transition-opacity`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}
