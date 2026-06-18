"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Heart, Loader2, ExternalLink } from "lucide-react"
import { collection, query, limit } from "firebase/firestore"
import { useFirestore, useMemoFirebase, useCollection } from "@/firebase"
import { cn } from "@/lib/utils"

export default function PublicSponsors() {
  const db = useFirestore()

  const sponsorsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "sponsors"), limit(50))
  }, [db])

  const { data: sponsors, loading } = useCollection(sponsorsQuery)

  const tiers = {
    gold: sponsors?.filter(s => s.tier === "gold"),
    silver: sponsors?.filter(s => s.tier === "silver"),
    bronze: sponsors?.filter(s => s.tier === "bronze")
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-white">
      <header className="p-6 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2">
          <Heart className="text-primary h-6 w-6" />
          <span className="font-headline font-bold text-xl uppercase">Our Partners</span>
        </Link>
      </header>

      <main className="container max-w-5xl mx-auto py-16 px-6">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-headline font-bold mb-6 tracking-tighter">Supported By The Best</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Our club is powered by these incredible partners. Join our community of supporters.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center p-20"><Loader2 className="animate-spin h-12 w-12 text-primary" /></div>
        ) : (
          <div className="space-y-20">
            {/* Gold Partners */}
            {tiers.gold && tiers.gold.length > 0 && (
              <section>
                <div className="flex items-center justify-center gap-4 mb-10">
                  <div className="h-px bg-amber-400/30 flex-1"></div>
                  <Badge className="bg-amber-400 text-amber-950 px-6 py-2 text-lg">GOLD PARTNERS</Badge>
                  <div className="h-px bg-amber-400/30 flex-1"></div>
                </div>
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                  {tiers.gold.map(s => <SponsorCard key={s.id} sponsor={s} size="lg" />)}
                </div>
              </section>
            )}

            {/* Silver Partners */}
            {tiers.silver && tiers.silver.length > 0 && (
              <section>
                <div className="flex items-center justify-center gap-4 mb-10">
                  <div className="h-px bg-slate-300/30 flex-1"></div>
                  <Badge className="bg-slate-300 text-slate-950 px-6 py-2 text-lg">SILVER PARTNERS</Badge>
                  <div className="h-px bg-slate-300/30 flex-1"></div>
                </div>
                <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-4">
                  {tiers.silver.map(s => <SponsorCard key={s.id} sponsor={s} size="md" />)}
                </div>
              </section>
            )}

            {/* Bronze Sponsors */}
            {tiers.bronze && tiers.bronze.length > 0 && (
              <section>
                <div className="flex items-center justify-center gap-4 mb-10">
                  <div className="h-px bg-orange-400/30 flex-1"></div>
                  <Badge className="bg-orange-400 text-orange-950 px-6 py-2">BRONZE SPONSORS</Badge>
                  <div className="h-px bg-orange-400/30 flex-1"></div>
                </div>
                <div className="flex flex-wrap justify-center gap-6">
                  {tiers.bronze.map(s => <SponsorCard key={s.id} sponsor={s} size="sm" />)}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function SponsorCard({ sponsor, size }: { sponsor: any, size: 'lg' | 'md' | 'sm' }) {
  const heights = { lg: 'h-40', md: 'h-32', sm: 'h-24' }
  const widths = { lg: 'w-full', md: 'w-full', sm: 'w-48' }

  return (
    <Card className={cn("bg-card/50 border-white/5 group hover:border-primary/40 transition-all", widths[size])}>
      <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-4">
        <div className={cn("bg-white/5 rounded-2xl flex items-center justify-center overflow-hidden w-full", heights[size])}>
          <img 
            src={sponsor.logoUrl} 
            alt={sponsor.name} 
            className="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform"
          />
        </div>
        <div>
          <h3 className="font-headline font-bold text-xl">{sponsor.name}</h3>
          {sponsor.websiteUrl && (
            <a href={sponsor.websiteUrl} target="_blank" className="text-primary text-sm flex items-center justify-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <ExternalLink className="h-3 w-3" /> Visit Website
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
