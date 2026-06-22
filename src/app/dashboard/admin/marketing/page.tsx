'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Megaphone, 
  Ticket, 
  Star, 
  Send, 
  Plus, 
  Trash2, 
  Loader2, 
  Globe, 
  Zap, 
  Sparkles,
  Trophy,
  Handshake,
  Briefcase,
  ExternalLink
} from 'lucide-react';
import { collection, query, limit, doc, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function MarketingCenter() {
  const db = useFirestore();
  const { toast } = useToast();
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  
  const [newPromo, setNewPromo] = useState({ code: '', discount: 10 });
  const [isAddingPromo, setIsAddingPromo] = useState(false);

  const promosQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "promocodes"), limit(20));
  }, [db]);

  const tournamentsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "tournaments"), limit(50));
  }, [db]);

  const { data: promos, loading: promosLoading } = useCollection(promosQuery);
  const { data: tournaments } = useCollection(tournamentsQuery);

  const handleBroadcast = () => {
    if (!broadcastMsg) return;
    setIsBroadcasting(true);
    // Simulate global broadcast delay
    setTimeout(() => {
      toast({ title: "Broadcast Sent", description: "Message delivered to all Club Owners via dashboard and email." });
      setBroadcastMsg('');
      setIsBroadcasting(false);
    }, 1500);
  };

  const handleAddPromo = () => {
    if (!db || !newPromo.code) return;
    setIsAddingPromo(true);
    addDoc(collection(db, "promocodes"), {
      code: newPromo.code.toUpperCase(),
      discountPercent: Number(newPromo.discount),
      active: true,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }).then(() => {
      toast({ title: "Promo Code Created" });
      setNewPromo({ code: '', discount: 10 });
    }).finally(() => setIsAddingPromo(false));
  };

  const toggleFeatured = (tId: string, current: boolean) => {
    if (!db) return;
    updateDoc(doc(db, "tournaments", tId), { isFeatured: !current })
      .then(() => toast({ title: current ? "Unfeatured" : "Featured" }));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-headline font-bold text-white uppercase tracking-tighter">Marketing Command</h1>
          <p className="text-muted-foreground font-medium">Manage growth, promotions, and platform visibility.</p>
        </div>
        <Badge variant="outline" className="border-accent text-accent bg-accent/5 px-4 h-8 uppercase tracking-widest font-bold">
           Network Status: ACTIVE
        </Badge>
      </div>

      <Tabs defaultValue="campaigns" className="w-full">
        <TabsList className="bg-secondary/30 mb-8 p-1">
           <TabsTrigger value="campaigns" className="px-8">Core Campaigns</TabsTrigger>
           <TabsTrigger value="sponsorships" className="px-8 flex items-center gap-2">
              Sponsorship Hub <Badge variant="outline" className="text-[8px] h-4 border-primary text-primary px-1">NEW</Badge>
           </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7 space-y-8">
              <Card className="bg-[#1E293B] border-primary/20 shadow-2xl relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12"><Megaphone className="h-32 w-32" /></div>
                 <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl font-headline">
                      <Globe className="h-5 w-5 text-primary" />
                      Global Club Broadcast
                    </CardTitle>
                    <CardDescription>Direct message to all sports organizations on the platform.</CardDescription>
                 </CardHeader>
                 <CardContent className="space-y-4">
                    <Textarea 
                      placeholder="Announce system updates, new features, or platform-wide tournament series..."
                      className="min-h-[150px] bg-background/50 border-white/10"
                      value={broadcastMsg}
                      onChange={e => setBroadcastMsg(e.target.value)}
                    />
                    <Button className="w-full bg-primary h-12 text-lg font-bold" onClick={handleBroadcast} disabled={isBroadcasting || !broadcastMsg}>
                      {isBroadcasting ? <Loader2 className="animate-spin mr-2" /> : <Send className="mr-2 h-5 w-5" />}
                      Launch Broadcast
                    </Button>
                 </CardContent>
              </Card>

              <Card className="bg-card/50 border-white/5">
                 <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-amber-400" />
                      Featured Tournament Inventory
                    </CardTitle>
                    <CardDescription>Select events to highlight on the public landing page.</CardDescription>
                 </CardHeader>
                 <CardContent>
                    <div className="space-y-3">
                      {tournaments?.filter(t => t.status !== 'completed').slice(0, 5).map(t => (
                        <div key={t.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group">
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center text-primary group-hover:scale-110 transition-transform"><Trophy className="h-5 w-5" /></div>
                              <div>
                                <p className="font-bold text-sm">{t.name}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">{t.sport} • {t.startDate}</p>
                              </div>
                           </div>
                           <Button 
                            variant={t.isFeatured ? "default" : "outline"} 
                            size="sm" 
                            className={t.isFeatured ? "bg-amber-500 text-amber-950" : ""}
                            onClick={() => toggleFeatured(t.id, !!t.isFeatured)}
                           >
                             {t.isFeatured ? "Featured" : "Feature"}
                           </Button>
                        </div>
                      ))}
                    </div>
                 </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-5 space-y-8">
               <Card className="bg-card/50 border-border">
                  <CardHeader>
                     <CardTitle className="flex items-center gap-2">
                       <Ticket className="h-5 w-5 text-accent" />
                       Promo Engine
                     </CardTitle>
                     <CardDescription>Manage platform-wide fee discount codes.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                     <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Promo Code</Label>
                          <Input 
                            placeholder="e.g. SUMMERSAAS" 
                            value={newPromo.code} 
                            onChange={e => setNewPromo({...newPromo, code: e.target.value})}
                            className="bg-secondary/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Discount Percent</Label>
                          <div className="flex gap-4">
                            <Input 
                              type="number" 
                              max="100" 
                              value={newPromo.discount} 
                              onChange={e => setNewPromo({...newPromo, discount: parseInt(e.target.value) || 0})}
                              className="bg-secondary/30"
                            />
                            <Button onClick={handleAddPromo} disabled={isAddingPromo || !newPromo.code}>
                               {isAddingPromo ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                     </div>

                     <div className="pt-6 border-t border-white/5 space-y-3">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Active Coupons</p>
                        {promos?.map(p => (
                          <div key={p.id} className="flex items-center justify-between p-3 bg-accent/5 rounded-lg border border-accent/20">
                             <div>
                                <p className="font-mono text-xs font-bold text-accent">{p.code}</p>
                                <p className="text-[9px] text-muted-foreground">{p.discountPercent}% Off Platform Fees</p>
                             </div>
                             <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteDoc(doc(db, "promocodes", p.id))}>
                                <Trash2 className="h-3 w-3" />
                             </Button>
                          </div>
                        ))}
                        {!promos?.length && <p className="text-center py-4 text-xs italic text-muted-foreground">No promo codes active.</p>}
                     </div>
                  </CardContent>
               </Card>

               <div className="bg-primary/10 border border-primary/20 p-6 rounded-3xl relative overflow-hidden group">
                  <Zap className="absolute -right-4 -top-4 h-24 w-24 text-primary opacity-10 group-hover:scale-125 transition-transform" />
                  <h3 className="font-headline font-bold text-primary mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> Marketing Pro-Tip
                  </h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Featured tournaments appear in the &quot;Live Arenas&quot; feed for guest users. Use this to highlight elite series or professional matches to drive guest traffic.
                  </p>
               </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sponsorships">
          <Card className="bg-card/50 border-white/5 overflow-hidden">
             <div className="p-20 text-center space-y-6">
                <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto border border-primary/20 animate-pulse">
                   <Handshake className="h-10 w-10 text-primary" />
                </div>
                <div>
                   <h2 className="text-3xl font-headline font-bold uppercase tracking-tighter">Sponsorship Network Hub</h2>
                   <p className="text-muted-foreground max-w-lg mx-auto mt-2">
                      In the future, brands will bid on tournament placements here. You will earn a <strong>5% Finder&apos;s Fee</strong> on every matched sponsorship deal.
                   </p>
                </div>
                <div className="flex justify-center gap-4">
                   <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
                      <Briefcase className="mr-2 h-4 w-4" /> View Pending Bids
                   </Button>
                   <Button variant="ghost" className="text-muted-foreground">
                      <ExternalLink className="mr-2 h-4 w-4" /> Strategy Deck
                   </Button>
                </div>
             </div>
             <div className="bg-black/20 p-4 border-t border-white/5 flex items-center justify-center gap-6 opacity-30 grayscale">
                <div className="text-[10px] font-bold uppercase tracking-[0.3em]">PARTNER BRANDS:</div>
                <div className="h-8 w-24 bg-white/10 rounded"></div>
                <div className="h-8 w-24 bg-white/10 rounded"></div>
                <div className="h-8 w-24 bg-white/10 rounded"></div>
                <div className="h-8 w-24 bg-white/10 rounded"></div>
             </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}