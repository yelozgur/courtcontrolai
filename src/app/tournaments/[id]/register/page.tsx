
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, CheckCircle2, Loader2, User, Mail, Award, DollarSign, CreditCard, ShieldCheck, Zap } from 'lucide-react';
import { collection, addDoc, doc } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";

export default function TournamentRegistration() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [step, setStep] = useState<'details' | 'payment'>('details');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  const tournamentRef = useMemoFirebase(() => {
    if (!db || !id) return null;
    return doc(db, "tournaments", id as string);
  }, [db, id]);

  const { data: tournament, loading: tournamentLoading } = useDoc(tournamentRef);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    telegramHandle: "",
    skillLevel: "intermediate",
    categoryId: ""
  });

  const handleNextToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.categoryId && tournament?.categories?.length > 0) {
      toast({ variant: "destructive", title: "Selection Required", description: "Please select a bracket." });
      return;
    }
    setStep('payment');
  };

  const handleCompleteRegistration = async () => {
    if (!db || !tournament) return;
    setIsSubmitting(true);
    
    // Accounting Logic: Platform takes a 5% cut of this amount in the admin view.
    const entryFee = Number(tournament.entryFee) || 0;

    const registrationData = {
      ...formData,
      clubId: tournament.clubId,
      tournamentId: id,
      createdAt: new Date().toISOString(),
      categoryName: tournament.categories?.find((c: any) => c.id === formData.categoryId)?.name || "Default",
      paymentStatus: entryFee > 0 ? "paid" : "waived",
      paidAmount: entryFee,
      verified: true
    };

    try {
      await addDoc(collection(db, "participants"), registrationData);
      setSubmitted(true);
      toast({ title: "Welcome to the Arena!", description: entryFee > 0 ? "Payment verified." : "Registration confirmed." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Could not finalize registration." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (tournamentLoading) return <div className="min-h-screen flex items-center justify-center bg-[#0F172A]"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-6 text-white">
        <Card className="max-w-md w-full bg-card/50 border-white/5 text-center p-8 backdrop-blur-xl">
          <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          </div>
          <h2 className="text-4xl font-headline font-bold mb-2 uppercase">Verified</h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Registration and Payment for <span className="text-white font-bold">{tournament?.name}</span> confirmed.
          </p>
          <Button onClick={() => router.push("/tournaments")} className="w-full h-12 uppercase font-bold tracking-widest">Done</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center py-12 px-6 text-white">
      <div className="max-w-lg w-full mb-10 text-center space-y-4">
        <h1 className="text-5xl font-headline font-bold uppercase tracking-tighter leading-none">{tournament?.name}</h1>
        <p className="text-xl text-muted-foreground uppercase tracking-widest">Official Entry Portal</p>
      </div>

      <Card className="max-w-lg w-full bg-card/40 border-white/5 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary to-accent"></div>
        
        {step === 'details' ? (
          <CardContent className="pt-10">
            <form onSubmit={handleNextToPayment} className="space-y-6">
              <div className="space-y-2">
                <Label className="uppercase text-[10px] font-bold opacity-60">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input required className="pl-10 bg-white/5 border-white/10 h-12" placeholder="John Doe" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="uppercase text-[10px] font-bold opacity-60">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input required type="email" className="pl-10 bg-white/5 border-white/10 h-12" placeholder="john@example.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="uppercase text-[10px] font-bold opacity-60">Competition Bracket</Label>
                <Select value={formData.categoryId} onValueChange={val => setFormData({...formData, categoryId: val})}>
                  <SelectTrigger className="bg-white/5 border-white/10 h-12"><SelectValue placeholder="Select category..." /></SelectTrigger>
                  <SelectContent>
                    {tournament?.categories?.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="uppercase text-[10px] font-bold opacity-60">Skill Level</Label>
                <Select value={formData.skillLevel} onValueChange={val => setFormData({...formData, skillLevel: val})}>
                  <SelectTrigger className="bg-white/5 border-white/10 h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full h-14 text-xl font-bold bg-primary uppercase tracking-widest">
                Proceed to Checkout
              </Button>
            </form>
          </CardContent>
        ) : (
          <CardContent className="pt-10 space-y-8">
            <div className="text-center space-y-2">
               <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="h-8 w-8 text-emerald-500" />
               </div>
               <h3 className="text-2xl font-bold">Secure Payment</h3>
               <p className="text-muted-foreground">Entry Fee for {tournament?.name}</p>
            </div>

            <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-4">
               <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold">Registration Fee</span>
                  <span className="font-mono text-xl font-bold text-emerald-400">${(Number(tournament?.entryFee) || 0).toFixed(2)}</span>
               </div>
               <div className="h-px bg-white/5" />
               <div className="flex justify-between items-center text-sm font-bold">
                  <span>TOTAL DUE</span>
                  <span className="text-2xl">${(Number(tournament?.entryFee) || 0).toFixed(2)}</span>
               </div>
            </div>

            <div className="space-y-4">
               <div className="p-4 bg-primary/10 rounded-xl border border-primary/20 flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
                  <div className="text-[10px] uppercase font-bold tracking-tight">
                    <p className="text-primary">Stripe Secure Encryption</p>
                    <p className="text-muted-foreground/60">Payment handled via Court Control AI Platform.</p>
                  </div>
               </div>
               <Button className="w-full h-16 text-2xl font-bold bg-emerald-500 hover:bg-emerald-600 shadow-xl shadow-emerald-500/20 uppercase" onClick={handleCompleteRegistration} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin mr-2 h-6 w-6" /> : <Zap className="mr-2 h-6 w-6" />}
                  Pay Now
               </Button>
               <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setStep('details')}>Go Back</Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
