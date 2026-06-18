
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, CheckCircle2, Loader2, User, Mail, Award, DollarSign, CreditCard, ShieldCheck, Zap, Lock, Info, Send, MessageSquare } from 'lucide-react';
import { collection, addDoc, doc } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
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

  const clubRef = useMemoFirebase(() => {
    if (!db || !tournament?.clubId) return null
    return doc(db, "clubs", tournament.clubId)
  }, [db, tournament?.clubId])
  const { data: club } = useDoc(clubRef)

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

  const handleCompleteRegistration = () => {
    if (!db || !tournament) return;
    setIsSubmitting(true);
    
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

    addDoc(collection(db, "participants"), registrationData)
      .then(() => {
        setSubmitted(true);
        toast({ title: "Welcome to the Arena!", description: entryFee > 0 ? "Payment verified." : "Registration confirmed." });
      })
      .catch(async (e) => {
        const error = new FirestorePermissionError({
          path: "participants",
          operation: 'create',
          requestResourceData: registrationData
        });
        errorEmitter.emit('permission-error', error);
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  if (tournamentLoading) return <div className="min-h-screen flex items-center justify-center bg-[#0F172A]"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-6 text-white text-center">
        <Card className="max-w-md w-full bg-card/50 border-white/5 p-12 backdrop-blur-xl shadow-2xl">
          <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          </div>
          <h2 className="text-4xl font-headline font-bold mb-4 uppercase tracking-tighter">Verified Entry</h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Welcome to <span className="text-white font-bold">{tournament?.name}</span>. Your registration is confirmed.
          </p>
          
          <div className="bg-primary/10 border border-primary/20 p-6 rounded-3xl mb-8 space-y-4">
             <div className="flex items-center justify-center gap-3 text-primary">
                <Send className="h-5 w-5" />
                <span className="font-bold uppercase tracking-widest text-xs">Live Notifications</span>
             </div>
             <p className="text-[11px] text-muted-foreground leading-relaxed">
               Join our Telegram Bot to receive real-time court assignments and match alerts directly on your phone.
             </p>
             <Button className="w-full bg-[#22D3EE] hover:bg-[#22D3EE]/90 text-black font-bold h-12" asChild>
                <a href={`https://t.me/${club?.telegramBotUsername || 'CourtControlBot'}`} target="_blank">
                  <MessageSquare className="mr-2 h-4 w-4" /> Start Club Bot
                </a>
             </Button>
          </div>

          <Button onClick={() => router.push("/tournaments")} variant="outline" className="w-full h-14 uppercase font-bold tracking-widest">Return to Feed</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center py-16 px-6 text-white">
      <div className="max-w-lg w-full mb-12 text-center space-y-4">
        {club?.logoUrl ? (
          <img src={club.logoUrl} className="h-16 w-16 object-contain mx-auto mb-4" alt="Club Logo" />
        ) : (
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-[0_0_20px_rgba(139,92,246,0.2)]">
             <Trophy className="h-8 w-8 text-primary" />
          </div>
        )}
        <h1 className="text-5xl font-headline font-bold uppercase tracking-tighter leading-none">{tournament?.name}</h1>
        <p className="text-xl text-muted-foreground uppercase tracking-widest font-medium opacity-60">Official Entry Portal</p>
      </div>

      <Card className="max-w-lg w-full bg-card/40 border-white/5 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary via-accent to-primary animate-pulse"></div>
        
        {step === 'details' ? (
          <CardContent className="pt-10">
            <form onSubmit={handleNextToPayment} className="space-y-6">
              <div className="space-y-2">
                <Label className="uppercase text-[10px] font-bold tracking-[0.2em] opacity-60">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input required className="pl-10 bg-white/5 border-white/10 h-12 text-lg" placeholder="John Doe" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="uppercase text-[10px] font-bold tracking-[0.2em] opacity-60">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input required type="email" className="pl-10 bg-white/5 border-white/10 h-12 text-lg" placeholder="john@example.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="uppercase text-[10px] font-bold tracking-[0.2em] opacity-60">Telegram @Handle (Optional)</Label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-10 bg-white/5 border-white/10 h-12 text-lg" placeholder="@username" value={formData.telegramHandle} onChange={e => setFormData({...formData, telegramHandle: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="uppercase text-[10px] font-bold tracking-[0.2em] opacity-60">Competition Bracket</Label>
                  <Select value={formData.categoryId} onValueChange={val => setFormData({...formData, categoryId: val})}>
                    <SelectTrigger className="bg-white/5 border-white/10 h-12"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {tournament?.categories?.map((cat: any) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="uppercase text-[10px] font-bold tracking-[0.2em] opacity-60">Skill Level</Label>
                  <Select value={formData.skillLevel} onValueChange={val => setFormData({...formData, skillLevel: val})}>
                    <SelectTrigger className="bg-white/5 border-white/10 h-12"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full h-16 text-xl font-bold bg-primary uppercase tracking-[0.2em] shadow-xl shadow-primary/20">
                Continue to Secure Payment
              </Button>
            </form>
          </CardContent>
        ) : (
          <CardContent className="pt-10 space-y-8">
            <div className="text-center space-y-2">
               <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                  <CreditCard className="h-8 w-8 text-emerald-500" />
               </div>
               <h3 className="text-2xl font-bold uppercase tracking-tight">Checkout</h3>
               <p className="text-muted-foreground text-sm">Review entry details for {tournament?.name}</p>
            </div>

            <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
               <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground uppercase tracking-[0.15em] text-[10px] font-bold">Standard Registration</span>
                  <span className="font-mono text-xl font-bold text-white">${(Number(tournament?.entryFee) || 0).toFixed(2)}</span>
               </div>
               <div className="h-px bg-white/5" />
               <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-emerald-500 uppercase tracking-widest text-[11px]">Total Due Today</span>
                  <span className="text-3xl font-headline tracking-tighter">${(Number(tournament?.entryFee) || 0).toFixed(2)}</span>
               </div>
            </div>

            <div className="space-y-6">
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <Label className="text-[9px] uppercase font-bold opacity-60">Card Number</Label>
                     <div className="relative">
                        <Lock className="absolute left-3 top-3 h-3 w-3 text-muted-foreground" />
                        <Input disabled value="**** **** **** 4242" className="bg-white/5 border-white/10 text-xs pl-8" />
                     </div>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[9px] uppercase font-bold opacity-60">CVV / Expiry</Label>
                     <Input disabled value="*** / 12-26" className="bg-white/5 border-white/10 text-xs text-center" />
                  </div>
               </div>

               <div className="p-4 bg-primary/10 rounded-xl border border-primary/20 flex items-start gap-4">
                  <ShieldCheck className="h-6 w-6 text-primary mt-1" />
                  <div className="text-[10px] uppercase font-bold tracking-tight space-y-1">
                    <p className="text-white">Encrypted Checkout</p>
                    <p className="text-muted-foreground leading-relaxed">Transactions are processed via Court Control AI using bank-grade AES-256 encryption.</p>
                  </div>
               </div>

               <Button 
                className="w-full h-20 text-2xl font-bold bg-emerald-500 hover:bg-emerald-600 shadow-2xl shadow-emerald-500/20 uppercase tracking-[0.1em] group transition-all" 
                onClick={handleCompleteRegistration} 
                disabled={isSubmitting}
               >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin mr-3 h-6 w-6" /> 
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-3 h-6 w-6 text-white group-hover:scale-125 transition-transform" /> 
                      Authorize & Pay
                    </>
                  )}
               </Button>
               
               <Button variant="ghost" className="w-full text-muted-foreground text-xs uppercase tracking-widest font-bold" onClick={() => setStep('details')}>
                 Go Back to Details
               </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
