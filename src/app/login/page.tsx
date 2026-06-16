
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Zap, LogIn, Loader2, Mail, Lock, AlertCircle, Circle } from 'lucide-react';
import { useAuth, useUser } from '@/firebase';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

export default function LoginPage() {
  const { user, loading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorType, setErrorType] = useState<'config' | 'creds' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !db) return;
    setIsSubmitting(true);
    setErrorType(null);
    setErrorMessage(null);

    try {
      const loginEmail = email === 'admin' ? 'admin@platform.com' : email;
      const loginPassword = email === 'admin' && password === 'adm' ? 'password' : password;

      const result = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const loggedUser = result.user;

      const userRef = doc(db, 'users', loggedUser.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          email: loggedUser.email,
          displayName: loggedUser.displayName || email.split('@')[0],
          role: email === 'admin' ? 'admin' : 'user',
          createdAt: serverTimestamp(),
        });
      }

      toast({
        title: 'Welcome Back',
        description: 'You have successfully signed in.',
      });
      router.push('/dashboard');
    } catch (error: any) {
      console.error(error);
      
      if (error.code === 'auth/configuration-not-found' || error.message.includes('auth/api-key-not-valid')) {
        setErrorType('config');
        setErrorMessage(error.message);
      } else {
        setErrorType('creds');
        setErrorMessage(error.message);
      }

      toast({
        variant: 'destructive',
        title: 'Sign In Failed',
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!auth || !db) return;
    setIsSubmitting(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: 'user',
          createdAt: serverTimestamp(),
        });
      }

      toast({
        title: 'Welcome Back',
        description: 'Signed in with Google.',
      });
      router.push('/dashboard');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Google Login Failed',
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] p-4">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg">
          <Zap className="text-white h-6 w-6" />
        </div>
        <span className="text-2xl font-headline font-bold text-white tracking-tighter uppercase">CourtControl AI</span>
      </Link>

      <Card className="w-full max-w-md border-white/5 bg-card/50 backdrop-blur-xl">
        <CardHeader className="text-center space-y-1">
          <CardTitle className="text-2xl font-headline font-bold">Sign In</CardTitle>
          <CardDescription>
            Enter your credentials to access your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorType === 'config' && (
            <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="font-bold">Firebase Setup Required</AlertTitle>
              <AlertDescription className="mt-2 space-y-2">
                <p className="text-xs">Your Firebase project is connected, but the Auth service is not enabled. Please do the following:</p>
                <ul className="text-[11px] space-y-1 bg-black/20 p-2 rounded border border-white/5">
                  <li className="flex items-center gap-2"><Circle className="h-2 w-2 fill-destructive" /> Go to Firebase Console</li>
                  <li className="flex items-center gap-2"><Circle className="h-2 w-2 fill-destructive" /> Select <strong>Build {'>'} Authentication</strong></li>
                  <li className="flex items-center gap-2"><Circle className="h-2 w-2 fill-destructive" /> Click <strong>Get Started</strong></li>
                  <li className="flex items-center gap-2"><Circle className="h-2 w-2 fill-destructive" /> Enable <strong>Email/Password</strong> & <strong>Google</strong></li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {errorType === 'creds' && (
            <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-500">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Login Issue</AlertTitle>
              <AlertDescription className="text-xs">
                {errorMessage}
              </AlertDescription>
            </Alert>
          )}

          <Button 
            variant="outline" 
            className="w-full bg-white/5 border-white/10 hover:bg-white/10"
            onClick={handleGoogleLogin}
            disabled={isSubmitting}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#0F172A] px-2 text-muted-foreground">Or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email or Username</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  placeholder="name@example.com"
                  className="pl-10 bg-white/5 border-white/10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10 bg-white/5 border-white/10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-11" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
              Sign In
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-muted-foreground">
            Don't have an account?{' '}
            <Link href="/signup" className="text-primary hover:underline font-bold">
              Sign Up
            </Link>
          </div>
          <div className="bg-primary/10 p-3 rounded-lg text-[10px] text-primary font-mono text-center">
            Super Admin: <strong>admin</strong> / <strong>adm</strong>
            <br />
            (Requires account creation via signup first)
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
