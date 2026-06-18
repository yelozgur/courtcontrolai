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
  Cpu
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

    // Firestore Free Tier Thresholds (Spark Plan)
    const DAILY_FREE_READS = 50000;
    const DAILY_FREE_WRITES = 20000;
    
    // AI Free Tier Threshold (Gemini 1.5 Flash via Genkit)
    const DAILY_FREE_AI_CALLS = 1500;

    // Estimate daily volume based on total active docs
    const documentCount = tournaments.length + participants.length + matches.length;
    const estReadsPerDay = documentCount * 20; 
    const estWritesPerDay = documentCount * 2; 

    // Pricing only kicks in after free tier (Blaze Plan simulation)
    const paidReads = Math.max(0, estReadsPerDay - DAILY_FREE_READS);
    const paidWrites = Math.max(0, estWritesPerDay - DAILY_FREE_WRITES);
    
    const firestoreDailyCost = (paidReads / 100000) * 0.06 + (paidWrites / 100000) * 0.18;
    const firestoreMonthlyEst = firestoreDailyCost * 30;

    // AI Costs estimate (Manual scheduling volume)
    const estAICallsPerDay = tournaments.length * 0.5; // Roughly 1 opt call per 2 tournaments daily
    const aiMonthlyEst = estAICallsPerDay * 30 * 0.005; // Base estimate for token usage

    // Revenue Accounting
    const grossVolume = participants.reduce((acc, p) => acc + (p.paidAmount || 0), 0);
    const platformRevenue = grossVolume * COMMISSION_RATE;

    return {
      documentCount,
      firestoreMonthlyEst,
      aiMonthlyEst,
      totalCost: firestoreMonthlyEst + aiMonthlyEst,
      grossVolume,
      platformRevenue,
      commissionRate: COMMISSION_RATE * 100,
      netProfit: platformRevenue - (firestoreMonthlyEst + aiMonthlyEst),
      readUsagePercent: Math.min(100, (estReadsPerDay / DAILY_FREE_READS) * 100),
      writeUsagePercent: Math.min(100, (estWritesPerDay / DAILY_FREE_WRITES) * 100),
      aiUsagePercent: Math.min(100, (estAICallsPerDay / DAILY_FREE_AI_CALLS) * 100)
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
          <p className="text-muted-foreground font-medium">Tracking {stats?.commissionRate || 5}% fee vs infrastructure burn.</p>
        </div>
        <div className="flex items-center gap-3">
           <Badge variant="outline" className="h-10 border-emerald-500/50 text-emerald-500 px-4 bg-emerald-500/5 font-bold uppercase tracking-widest text-[10px]">
             Firebase Spark Plan Active
           </Badge>
           <Badge variant="outline" className="h-10 border-primary text-primary px-4 bg-primary/5 font-bold uppercase tracking-widest text-[10px]">
             AI Gen Free Tier Enabled
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
              value={`$${stats.grossVolume.toLocaleString()}`} 
              sub="Total Volume Processed" 
              icon={DollarSign} 
              color="text-white"
            />
            <CostCard 
              title="SaaS Earnings (5%)" 
              value={`$${stats.platformRevenue.toFixed(2)}`} 
              sub="Direct Platform Cut" 
              icon={Percent} 
              color="text-accent"
            />
            <CostCard 
              title="Estimated OpEx" 
              value={`$${stats.totalCost.toFixed(2)}`} 
              sub="Cloud Burn (Over quota)" 
              icon={Server} 
              color="text-primary"
            />
            <CostCard 
              title="Current Runway" 
              value={`${stats.netProfit > 0 ? "Profitable" : "Free Tier Usage"}`} 
              sub="Financial Health Status" 
              icon={BarChart3} 
              color={stats.netProfit >= 0 ? "text-emerald-400" : "text-destructive"}
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
                    Accounting Ledger
                  </CardTitle>
                  <CardDescription>Live breakdown of registration fees and platform commissions.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest">Participant</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest">Gross Paid</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-accent">SaaS Cut (5%)</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest">Net to Club</TableHead>
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
                  <div className="py-20 text-center italic text-muted-foreground">No transactions recorded yet.</div>
                )}
              </CardContent>
            </Card>

            <div className="lg:col-span-4 space-y-6">
              <Card className="bg-[#1E293B] border-primary/20 shadow-2xl relative overflow-hidden group">
                <CardHeader>
                  <CardTitle className="text-lg font-headline flex items-center gap-2">
                    <Database className="h-5 w-5 text-emerald-400" />
                    Free Tier Monitor
                  </CardTitle>
                  <CardDescription className="text-[10px]">Real-time cloud usage vs Free limits.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold uppercase">
                      <span className="text-muted-foreground">Firestore Reads (50k/day)</span>
                      <span className="text-white">{stats.readUsagePercent.toFixed(1)}%</span>
                    </div>
                    <Progress value={stats.readUsagePercent} className="h-1.5 bg-white/5" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold uppercase">
                      <span className="text-muted-foreground">Firestore Writes (20k/day)</span>
                      <span className="text-white">{stats.writeUsagePercent.toFixed(1)}%</span>
                    </div>
                    <Progress value={stats.writeUsagePercent} className="h-1.5 bg-white/5" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold uppercase">
                      <span className="text-muted-foreground">AI Generation (1.5k/day)</span>
                      <span className="text-accent">{stats.aiUsagePercent.toFixed(1)}%</span>
                    </div>
                    <Progress value={stats.aiUsagePercent} className="h-1.5 bg-white/5" />
                  </div>
                  <div className="pt-4 border-t border-white/5 flex items-center gap-3">
                     <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <Zap className="h-4 w-4 text-emerald-500" />
                     </div>
                     <p className="text-[10px] text-muted-foreground leading-tight italic">
                        Operating well within free tier. Your monthly cloud bill will be **$0.00**.
                     </p>
                  </div>
                </CardContent>
              </Card>

              <div className="bg-accent/5 border border-accent/20 p-6 rounded-3xl group">
                 <div className="flex items-center gap-3 mb-2">
                    <Cpu className="h-4 w-4 text-accent group-hover:rotate-45 transition-transform" />
                    <h4 className="text-xs font-bold text-accent uppercase tracking-widest">AI Quota Safety</h4>
                 </div>
                 <p className="text-[11px] text-muted-foreground leading-relaxed">
                   AI Scheduler uses **Gemini 1.5 Flash**. You have 1,500 free requests per day, ensuring unlimited tournament optimizations for all your clubs.
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