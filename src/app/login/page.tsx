
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Zap, LogIn, Loader2 } from "lucide-react"
import { useAuth, useUser } from "@/firebase"
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { useFirestore } from "@/firebase"

export default function LoginPage() {
  const { user, loading } = useUser()
  const auth = useAuth()
  const db = useFirestore()
  const router = useRouter()

  useEffect(() => {
    if (user && !loading) {
      router.push("/dashboard")
    }
  }, [user, loading, router])

  const handleGoogleSignIn = async () => {
    if (!auth || !db) return
    const provider = new GoogleAuthProvider()
    try {
      const result = await signInWithPopup(auth, provider)
      const loggedUser = result.user

      // Check if user exists in Firestore, if not create them
      const userRef = doc(db, "users", loggedUser.uid)
      const userSnap = await getDoc(userRef)

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          email: loggedUser.email,
          displayName: loggedUser.displayName,
          photoURL: loggedUser.photoURL,
          role: "user", // Default role
          createdAt: serverTimestamp()
        })
      }
      
      router.push("/dashboard")
    } catch (error) {
      console.error("Error signing in:", error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] p-4">
      <div className="mb-8 flex items-center gap-3">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg">
          <Zap className="text-white h-6 w-6" />
        </div>
        <span className="text-2xl font-headline font-bold text-white tracking-tighter uppercase">CourtControl AI</span>
      </div>

      <Card className="w-full max-w-md border-white/5 bg-card/50 backdrop-blur-xl">
        <CardHeader className="text-center space-y-1">
          <CardTitle className="text-2xl font-headline font-bold">Welcome Back</CardTitle>
          <CardDescription>
            Sign in to manage your tournaments and view live stats.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            variant="outline" 
            className="w-full h-12 border-white/10 hover:bg-white/5 text-lg" 
            onClick={handleGoogleSignIn}
          >
            <LogIn className="mr-2 h-5 w-5" />
            Sign in with Google
          </Button>
          <p className="text-xs text-center text-muted-foreground pt-4">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
