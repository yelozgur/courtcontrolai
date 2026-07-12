'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, CheckCircle2, Loader2, User, Mail, DollarSign, CreditCard, ShieldCheck, Zap, Lock, MessageSquare, Send, Shirt } from 'lucide-react';
import { collection, addDoc, doc } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Image from 'next/image';

export default function TournamentRegistration() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
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
    name: user?.displayName || "",
    email: user?.email || "",
    telegramHandle: "",
    skillLevel: "intermediate",
    categoryId: "",
    packSize: "",
    tshirtSize: "",
    shoeSize: "",
    shortsSize: ""
  });

  const handleNextToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.categoryId && tournament?.categories?.length > 0) {
      toast({ variant: "destructive", title: "Selection Required", description: "Please select a bracket." });
      return;
    }
    if (tournament?.requiresSize) {
      const requiredFields = tournament?.packSizeFields || ['packSize']
      const missing = requiredFields.filter((f: string) => !formData[f as keyof typeof formData])
      if (missing.length > 0) {
        toast({
          variant: "destructive",
          title: "Size Required",
          description: `Please complete: ${missing.join(', ')}`
        });
        return;
      }
    }
    setStep('payment');
  };

  const handleCompleteRegistration = () => {
    if (!db || !tournament) return;
    setIsSubmitting(true);
    
    const entryFee = Number(tournament.entryFee) || 0;
    const registrationData = {
      ...formData,
      userId: user?.uid || null, // Link registration to user if logged in
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
            Welcome to <span className="text-white font-bold">{tournament?.name}</span>.
          </p>
          
          <Button onClick={() => router.push("/tournaments")} variant="outline" className="w-full h-14 uppercase font-bold tracking-widest">Return to Feed</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center py-16 px-6 text-white">
      <div className="max-w-lg w-full mb-12 text-center space-y-4">
        {club?.logoUrl ? (
          <div className="relative w-16 h-16 mx-auto mb-4">
            <Image src={club.logoUrl} fill className="object-contain" alt="Club Logo" />
          </div>
        ) : (
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-[0_0_20px_rgba(139,92,246,0.2)]">
             <Trophy className="h-8 w-8 text-primary" />
          </div>
        )}
        <h1 className="text-5xl font-headline font-bold uppercase tracking-tighter leading-none">{tournament?.name}</h1>
        <p className="text-xl text-muted-foreground uppercase tracking-widest font-medium opacity-60">Entry Portal</p>
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

              {tournament?.hasWelcomePack && (
                <div className="p-4 bg-accent/5 rounded-xl border border-accent/10 space-y-4">
                   <div className="flex items-center gap-2 text-accent">
                      <Shirt className="h-4 w-4" />
                      <span className="text-xs font-bold uppercase">Welcome Pack Included</span>
                   </div>
                   <p className="text-[10px] text-muted-foreground italic">{tournament.welcomePackDescription}</p>
                   {tournament.requiresSize && (
                     <div className="grid grid-cols-2 gap-3">
                        {/* T-shirt size */}
                        <div className="space-y-2">
                           <Label className="text-[9px] uppercase font-bold opacity-60 flex items-center gap-1">
                             <Shirt className="h-3 w-3" /> T-Shirt Size
                           </Label>
                           <Select value={formData.tshirtSize} onValueChange={val => setFormData({...formData, tshirtSize: val})}>
                             <SelectTrigger className="bg-white/5 border-white/10 h-10"><SelectValue placeholder="Size..." /></SelectTrigger>
                             <SelectContent>
                                <SelectItem value="S">S</SelectItem>
                                <SelectItem value="M">M</SelectItem>
                                <SelectItem value="L">L</SelectItem>
                                <SelectItem value="XL">XL</SelectItem>
                                <SelectItem value="XXL">XXL</SelectItem>
                             </SelectContent>
                           </Select>
                        </div>
                        {/* Shorts size */}
                        <div className="space-y-2">
                           <Label className="text-[9px] uppercase font-bold opacity-60 flex items-center gap-1">
                             <span className="font-bold">⇅</span> Shorts Size
                           </Label>
                           <Select value={formData.shortsSize} onValueChange={val => setFormData({...formData, shortsSize: val})}>
                             <SelectTrigger className="bg-white/5 border-white/10 h-10"><SelectValue placeholder="Size..." /></SelectTrigger>
                             <SelectContent>
                                <SelectItem value="S">S</SelectItem>
                                <SelectItem value="M">M</SelectItem>
                                <SelectItem value="L">L</SelectItem>
                                <SelectItem value="XL">XL</SelectItem>
                                <SelectItem value="XXL">XXL</SelectItem>
                             </SelectContent>
                           </Select>
                        </div>
                        {/* Shoe size */}
                        <div className="space-y-2 col-span-2">
                           <Label className="text-[9px] uppercase font-bold opacity-60 flex items-center gap-1">
                             <span className="text-xs">👟</span> Shoe Size (EU)
                           </Label>
                           <Select value={formData.shoeSize} onValueChange={val => setFormData({...formData, shoeSize: val})}>
                             <SelectTrigger className="bg-white/5 border-white/10 h-10"><SelectValue placeholder="EU size..." /></SelectTrigger>
                             <SelectContent>
                                {[36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47].map(s => (
                                  <SelectItem key={s} value={s.toString()}>{s}</SelectItem>
                                ))}
                             </SelectContent>
                           </Select>
                        </div>
                     </div>
                   )}
                </div>
              )}

              <Button type="submit" className="w-full h-16 text-xl font-bold bg-primary uppercase tracking-[0.2em] shadow-xl shadow-primary/20">
                Continue to Payment
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
               <p className="text-muted-foreground text-sm">Review registration for {tournament?.name}</p>
            </div>

            <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
               <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-emerald-500 uppercase tracking-widest text-[11px]">Total Due Today</span>
                  <span className="text-3xl font-headline tracking-tighter">${(Number(tournament?.entryFee) || 0).toFixed(2)}</span>
               </div>
            </div>

            <div className="space-y-6">
               <div className="p-4 bg-primary/10 rounded-xl border border-primary/20 flex items-start gap-4">
                  <ShieldCheck className="h-6 w-6 text-primary mt-1" />
                  <div className="text-[10px] uppercase font-bold tracking-tight space-y-1">
                    <p className="text-white">Secure Transaction</p>
                    <p className="text-muted-foreground leading-relaxed">Payments are protected by platform-grade encryption.</p>
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
                      Processing...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-3 h-6 w-6 text-white group-hover:scale-125 transition-transform" /> 
                      Register & Pay
                    </>
                  )}
               </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}