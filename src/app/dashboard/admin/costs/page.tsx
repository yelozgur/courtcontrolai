
'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Sparkles
} from 'lucide-react';
import { collection, query, limit } from 'firebase/firestore';
import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Progress } from '@/components/ui/progress';

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
    db ? query(collection(db, 'participants'), limit(5000)) : null
  );
  const { data: matches, loading: matchesLoading } = useCollection(
    db ? query(collection(db, 'matches'), limit(10000)) : null
  );

  const stats = useMemo(() => {
    if (!tournaments || !participants || !matches) return null;

    // Estimate Firestore Costs (Approximate pricing)
    // Write: $0.18 per 100k, Read: $0.06 per 100k
    // Simplified: document count as proxy for activity
    const documentCount = tournaments.length + participants.length + matches.length;
    const estReadsPerDay = documentCount * 20; // Average app interaction
    const estWritesPerDay = documentCount * 2; 

    const firestoreDailyCost = (estReadsPerDay / 100000) * 0.06 + (estWritesPerDay / 100000) * 0.18;
    const firestoreMonthlyEst = firestoreDailyCost * 30;

    // Estimate Genkit AI Costs
    // Est: $0.01 per Optimization Flow call
    const estAIFlows = tournaments.length * 2; 
    const aiMonthlyEst = estAIFlows * 0.01;

    // Revenue
    const grossRevenue = participants.reduce((acc, p) => acc + (p.paidAmount || 0), 0);
    const platformCommission = grossRevenue * 0.10; // Assume 10% SaaS cut

    return {
      documentCount,
      firestoreMonthlyEst,
      aiMonthlyEst,
      totalCost: firestoreMonthlyEst + aiMonthlyEst + 5, // $5 baseline hosting
      grossRevenue,
      platformCommission,
      netProfit: platformCommission - (firestoreMonthlyEst + aiMonthlyEst + 5)
    };
  }, [tournaments, participants, matches]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground">This dashboard is restricted to SaaS Platform Administrators.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <h1 className="text-3xl font-headline font-bold uppercase tracking-tighter">SaaS Unit Economics</h1>
        <p className="text-muted-foreground font-medium">Analyze platform operational costs and revenue margins.</p>
      </div>

      {(toursLoading || partsLoading || matchesLoading) ? (
        <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>
      ) : stats && (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <CostCard 
              title="Est. Cloud Costs" 
              value={`$${stats.totalCost.toFixed(2)}`} 
              sub="Projected Monthly" 
              icon={Server} 
              color="text-primary"
            />
            <CostCard 
              title="Gross GMV" 
              value={`$${stats.grossRevenue.toLocaleString()}`} 
              sub="Total Entry Fees" 
              icon={DollarSign} 
              color="text-emerald-500"
            />
            <CostCard 
              title="Platform Rev" 
              value={`$${stats.platformCommission.toFixed(2)}`} 
              sub="SaaS Commission (10%)" 
              icon={TrendingUp} 
              color="text-accent"
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
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Cloud Resource Utilization
                </CardTitle>
                <CardDescription>Estimated consumption based on document volume.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-bold uppercase tracking-widest text-[10px] text-muted-foreground">Firestore Doc Count</span>
                    <span className="font-mono">{stats.documentCount.toLocaleString()} / 1M Free</span>
                  </div>
                  <Progress value={(stats.documentCount / 1000000) * 100} className="h-2 bg-white/5" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                    <div className="flex items-center gap-3">
                      <Zap className="h-5 w-5 text-accent" />
                      <h4 className="font-bold">Database Activity</h4>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Projected Reads/Write ops per month based on current traffic.</p>
                      <p className="text-2xl font-mono font-bold">${stats.firestoreMonthlyEst.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <h4 className="font-bold">AI Optimization</h4>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Genkit Flow executions for automated tournament scheduling.</p>
                      <p className="text-2xl font-mono font-bold">${stats.aiMonthlyEst.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-4 bg-[#1E293B] border-primary/20 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-lg">Revenue Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                   <p className="text-[10px] uppercase font-bold text-emerald-500 mb-1">Total Volume</p>
                   <p className="text-3xl font-headline font-bold text-white">${stats.grossRevenue.toFixed(2)}</p>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Payment Processing (3%)</span>
                    <span className="font-mono text-destructive">-${(stats.grossRevenue * 0.03).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Club Payouts (87%)</span>
                    <span className="font-mono">-${(stats.grossRevenue * 0.87).toFixed(2)}</span>
                  </div>
                  <div className="pt-4 border-t border-white/5 flex justify-between text-lg font-bold">
                    <span className="text-accent uppercase text-xs tracking-widest mt-1">Platform Cut</span>
                    <span className="font-mono text-white">${stats.platformCommission.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function CostCard({ title, value, sub, icon: Icon, color }: any) {
  return (
    <Card className="bg-white/5 border-white/5">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}
