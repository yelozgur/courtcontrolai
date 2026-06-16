
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, CheckCircle2, Loader2, User, Mail, Send, Award } from 'lucide-react';
import { collection, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { useFirestore, useDoc } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

export default function TournamentRegistration() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  const tournamentRef = db ? doc(db, "tournaments", id as string) : null;
  const { data: tournament, loading: tournamentLoading } = useDoc(tournamentRef);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    telegramHandle: "",
    skillLevel: "intermediate",
    categoryId: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !tournament) return;
    
    if (!formData.categoryId) {
      toast({ variant: "destructive", title: "Selection Required", description: "Please select a competition category." });
      return;
    }

    setIsSubmitting(true);
    
    const registrationData = {
      ...formData,
      clubId: tournament.clubId,
      tournamentId: id,
      registeredAt: serverTimestamp(),
      categoryName: tournament.categories?.find((c: any) => c.id === formData.categoryId)?.name || "Default"
    };

    try {
      await addDoc(collection(db, "participants"), registrationData);
      setSubmitted(true);
      toast({ title: "Registration Successful!", description: "You've been added to the tournament roster." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Could not complete registration." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (tournamentLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] gap-4">
        <Loader2 className="animate-spin text-primary h-12 w-12" />
        <p className="text-muted-foreground font-headline font-bold uppercase tracking-widest animate-pulse">Loading Event Details...</p>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] text-white p-6 text-center">
        <Trophy className="h-16 w-16 text-muted-foreground mb-4 opacity-20" />
        <h2 className="text-3xl font-headline font-bold">Tournament Not Found</h2>
        <p className="text-muted-foreground mt-2">This event may have been moved or archived.</p>
        <Button onClick={() => router.push("/tournaments")} className="mt-8">View All Events</Button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6 text-white">
        <Card className="max-w-md w-full bg-card/50 border-white/5 text-center p-8 backdrop-blur-xl">
          <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          </div>
          <h2 className="text-4xl font-headline font-bold mb-2 tracking-tight uppercase">Confirmed!</h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Registration for <span className="text-white font-bold">{tournament.name}</span> is complete. 
            Keep an eye on your Telegram for court assignments.
          </p>
          <Button onClick={() => router.push("/tournaments")} className="w-full h-12 font-bold uppercase tracking-widest">
            Back to Tournaments
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-6 text-white">
      <div className="mb-10 text-center space-y-2">
        <Trophy className="h-14 w-14 text-primary mx-auto mb-4" />
        <h1 className="text-5xl font-headline font-bold uppercase tracking-tighter leading-none">Event Registration</h1>
        <p className="text-xl text-muted-foreground font-medium">{tournament.name} • {tournament.sport.toUpperCase()}</p>
      </div>

      <Card className="max-w-lg w-full bg-card/40 border-white/5 shadow-2xl backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="font-headline font-bold uppercase text-2xl">Entry Details</CardTitle>
          <CardDescription className="text-base">Join the competition at {tournament.location || 'Ace Padel Club'}.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label className="uppercase tracking-widest text-xs font-bold opacity-60">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  required
                  className="pl-10 bg-white/5 border-white/10 h-12 text-lg"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="uppercase tracking-widest text-xs font-bold opacity-60">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  required
                  type="email"
                  className="pl-10 bg-white/5 border-white/10 h-12 text-lg"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="uppercase tracking-widest text-xs font-bold opacity-60">Select Category</Label>
              <div className="relative">
                <Award className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground z-10" />
                <Select value={formData.categoryId} onValueChange={val => setFormData({...formData, categoryId: val})}>
                  <SelectTrigger className="pl-10 bg-white/5 border-white/10 h-12 text-lg">
                    <SelectValue placeholder="Choose competition..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tournament.categories?.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name} ({cat.ageGroup})
                      </SelectItem>
                    ))}
                    {!tournament.categories?.length && (
                      <SelectItem value="open">Open Category</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="uppercase tracking-widest text-xs font-bold opacity-60">Skill Level</Label>
                <Select value={formData.skillLevel} onValueChange={val => setFormData({...formData, skillLevel: val})}>
                  <SelectTrigger className="bg-white/5 border-white/10 h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="pro">Pro / Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="uppercase tracking-widest text-xs font-bold opacity-60">Telegram Handle</Label>
                <div className="relative">
                  <Send className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    className="pl-10 bg-white/5 border-white/10 h-12"
                    placeholder="@username"
                    value={formData.telegramHandle}
                    onChange={e => setFormData({...formData, telegramHandle: e.target.value})}
                  />
                </div>
              </div>
            </div>
            
            <Button type="submit" className="w-full h-14 text-xl font-bold bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 uppercase tracking-widest" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin mr-2 h-6 w-6" /> : null}
              Confirm Registration
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <p className="mt-8 text-muted-foreground text-sm max-w-sm text-center">
        By registering, you agree to receive automated notifications regarding court assignments and match results.
      </p>
    </div>
  );
}
