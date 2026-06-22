'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Zap, UserPlus, Loader2, Mail, Lock, User, Globe, Trophy, Monitor, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function SignupPage() {
  const { user: existingUser, loading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [errorType, setErrorType] = useState<'config' | 'creds' | 'firestore' | 'domain' | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !db) return;
    setIsSubmitting(true);
    setErrorType(null);

    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const user = result.user;
      await updateProfile(user, { displayName: name });

      const isAdminEmail = email?.toLowerCase() === 'admin@deneme.com';
      setIsAdminUser(isAdminEmail);

      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        displayName: name,
        role: isAdminEmail ? 'admin' : 'club_owner',
        createdAt: serverTimestamp(),
      });

      setAuthSuccess(true);
    } catch (error: any) {
      setErrorType(error.code === 'auth/unauthorized-domain' ? 'domain' : 'config');
      toast({ variant: 'destructive', title: 'Signup Failed', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (!auth || !db) return;
    setIsSubmitting(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const isAdminEmail = user.email?.toLowerCase() === 'admin@deneme.com';
      setIsAdminUser(isAdminEmail);

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: isAdminEmail ? 'admin' : 'club_owner',
          createdAt: serverTimestamp(),
        });
      } else if (isAdminEmail && userSnap.data().role !== 'admin') {
        await setDoc(userRef, { role: 'admin' }, { merge: true });
      }

      setAuthSuccess(true);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Google Login Failed', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0F172A]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (authSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] p-4">
        <Card className="w-full max-w-lg border-primary/20 bg-card/50 backdrop-blur-xl p-8 space-y-8 animate-in fade-in zoom-in-95 duration-500">
          <div className="text-center space-y-2">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <CardTitle className="text-3xl font-headline font-bold uppercase tracking-tighter text-white">Registration Complete</CardTitle>
            <CardDescription className="text-lg">Welcome to the network. Choose your starting point.</CardDescription>
          </div>

          <div className="grid gap-4">
            <Button size="lg" className="h-20 text-lg font-bold flex flex-col items-center justify-center gap-1 group bg-primary/10 border-primary/20 hover:bg-primary/20 text-white" variant="outline" onClick={() => router.push('/dashboard')}>
              <Zap className="h-5 w-5 text-primary group-hover:animate-pulse" />
              <span>TOURNAMENT COMMAND</span>
            </Button>
            <div className="grid grid-cols-2 gap-4">
              <Button size="lg" className="h-20 text-sm font-bold flex flex-col items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-white" variant="outline" onClick={() => router.push('/tournaments')}>
                <Trophy className="h-5 w-5 text-amber-400" />
                <span>BROWSE EVENTS</span>
              </Button>
              <Button size="lg" className="h-20 text-sm font-bold flex flex-col items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-white" variant="outline" onClick={() => router.push('/arena')}>
                <Monitor className="h-5 w-5 text-accent" />
                <span>WATCH ARENA</span>
              </Button>
            </div>
            {isAdminUser && (
              <Button size="lg" className="h-16 font-bold border-accent/30 text-accent hover:bg-accent/10 flex items-center justify-center gap-2" variant="outline" onClick={() => router.push('/dashboard')}>
                <ShieldCheck className="h-5 w-5" />
                SAAS ADMIN CONSOLE
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] p-4">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg">
          <Zap className="text-white h-6 w-6" />
        </div>
        <span className="text-2xl font-headline font-bold text-white tracking-tighter uppercase">Court Control AI</span>
      </Link>

      <Card className="w-full max-w-md border-white/5 bg-card/50 backdrop-blur-xl">
        <CardHeader className="text-center space-y-1">
          <CardTitle className="text-2xl font-headline font-bold text-white">Register Club</CardTitle>
          <CardDescription>
            Create an account to manage your tournaments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full bg-white/5 border-white/10 hover:bg-white/10 text-white" onClick={handleGoogleSignup} disabled={isSubmitting}>
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15c-1.1-1.1-2.61-1.66-4.21-1.66-2.86 0-5.29-1.93-6.16-4.53L2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Sign up with Google
          </Button>
          <div className="relative"><div className="absolute inset-0 flex items-center"><Separator className="w-full" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-[#0F172A] px-2 text-muted-foreground">Or with email</span></div></div>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="name" className="text-white">Full Name</Label><div className="relative"><User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="name" placeholder="John Doe" className="pl-10 bg-white/5 border-white/10 text-white" value={name} onChange={(e) => setName(e.target.value)} required /></div></div>
            <div className="space-y-2"><Label htmlFor="email" className="text-white">Email</Label><div className="relative"><Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="email" type="email" placeholder="name@example.com" className="pl-10 bg-white/5 border-white/10 text-white" value={email} onChange={(e) => setEmail(e.target.value)} required /></div></div>
            <div className="space-y-2"><Label htmlFor="password" className="text-white">Password</Label><div className="relative"><Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="password" type="password" placeholder="••••••••" className="pl-10 bg-white/5 border-white/10 text-white" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></div></div>
            <Button type="submit" className="w-full h-11" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}Create Account</Button>
          </form>
        </CardContent>
        <CardFooter><div className="text-sm text-center w-full text-muted-foreground">Already have an account?{' '}<Link href="/login" className="text-primary hover:underline font-bold">Sign In</Link></div></CardFooter>
      </Card>
    </div>
  );
}
