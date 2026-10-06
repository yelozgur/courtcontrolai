'use client';

/**
 * Marketing Review Queue — admin only
 *
 * Lists AI-generated captions from `marketing_queue` collection. Admin can:
 * - Filter by status (pending/approved/rejected), locale (tr/en/el), tournament
 * - Preview captions side-by-side (TR/EN/EL for same tournament)
 * - Edit caption inline (optional)
 * - Approve / Reject (single + bulk)
 *
 * Pending items come from the marketing bot cron (09:00 daily). Approved items
 * can be picked up by the publishing script (Sprint 11 — auto-post to channels).
 */

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Check, X, Loader2, Sparkles, Globe, Trophy, Filter, RotateCw,
  Copy, CheckCheck, Calendar, MessageSquare,
} from 'lucide-react';
import {
  collection, query, where, orderBy, limit, doc, updateDoc, getDocs,
} from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

interface QueueItem {
  tournamentId: string;
  tournamentName: string;
  sport: string;
  startDate: string;
  locale: 'tr' | 'en' | 'el';
  caption: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'published';
  generatedAt: { seconds: number; nanoseconds: number } | string;
  generatedBy: string;
  model: string;
  approvedBy?: string;
  approvedAt?: { seconds: number; nanoseconds: number } | string;
}

type QueueItemWithId = QueueItem & { id: string };

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'pending_review', label: 'Pending', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { value: 'approved', label: 'Approved', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { value: 'rejected', label: 'Rejected', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
  { value: 'published', label: 'Published', color: 'bg-sky-500/20 text-sky-400 border-sky-500/30' },
];

const LOCALE_LABELS = { tr: '🇹🇷 TR', en: '🇬🇧 EN', el: '🇬🇷 EL' } as const;
const LOCALE_COLORS = {
  tr: 'bg-red-500/10 text-red-300 border-red-500/30',
  en: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  el: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
} as const;

export default function MarketingQueue() {
  const db = useFirestore();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('pending_review');
  const [localeFilter, setLocaleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');

  // Query with filters
  const queueQuery = useMemoFirebase(() => {
    if (!db) return null;
    const constraints: ReturnType<typeof where>[] = [];
    if (statusFilter !== 'all') constraints.push(where('status', '==', statusFilter));
    if (localeFilter !== 'all') constraints.push(where('locale', '==', localeFilter));
    return query(
      collection(db, 'marketing_queue'),
      ...constraints,
      orderBy('generatedAt', 'desc'),
      limit(100)
    );
  }, [db, statusFilter, localeFilter]);

  const { data: rawItems, loading } = useCollection(queueQuery) as { data: QueueItemWithId[] | null; loading: boolean };

  // Client-side search filter
  const items = useMemo(() => {
    if (!rawItems) return [];
    if (!searchQuery.trim()) return rawItems;
    const q = searchQuery.toLowerCase();
    return rawItems.filter(
      (it) =>
        it.tournamentName?.toLowerCase().includes(q) ||
        it.caption?.toLowerCase().includes(q)
    );
  }, [rawItems, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    if (!rawItems) return { pending: 0, approved: 0, rejected: 0, total: 0 };
    const all = rawItems as QueueItemWithId[];
    return {
      pending: all.filter((i) => i.status === 'pending_review').length,
      approved: all.filter((i) => i.status === 'approved').length,
      rejected: all.filter((i) => i.status === 'rejected').length,
      total: all.length,
    };
  }, [rawItems]);

  // Group by tournament so admin sees TR/EN/EL together
  const grouped = useMemo(() => {
    const m = new Map<string, QueueItemWithId[]>();
    for (const it of items as QueueItemWithId[]) {
      m.set(it.tournamentId, [...(m.get(it.tournamentId) || []), it]);
    }
    return Array.from(m.entries());
  }, [items]);

  const setProcessing = (id: string, on: boolean) => {
    setProcessingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleApprove = async (item: QueueItemWithId, editedCaption?: string) => {
    if (!db) return;
    setProcessing(item.id, true);
    try {
      await updateDoc(doc(db, 'marketing_queue', item.id), {
        status: 'approved',
        approvedBy: 'admin', // TODO: use actual auth.currentUser.email
        approvedAt: new Date().toISOString(),
        caption: editedCaption ?? item.caption,
      });
      toast({ title: 'Approved', description: `${item.locale.toUpperCase()} caption for ${item.tournamentName}` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Approve failed', description: (e as Error).message });
    } finally {
      setProcessing(item.id, false);
    }
  };

  const handleReject = async (item: QueueItemWithId) => {
    if (!db) return;
    setProcessing(item.id, true);
    try {
      await updateDoc(doc(db, 'marketing_queue', item.id), {
        status: 'rejected',
        approvedBy: 'admin',
        approvedAt: new Date().toISOString(),
      });
      toast({ title: 'Rejected', description: `${item.locale.toUpperCase()} caption for ${item.tournamentName}` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Reject failed', description: (e as Error).message });
    } finally {
      setProcessing(item.id, false);
    }
  };

  const handleBulkApprove = async (tournamentId: string) => {
    if (!db) return;
    const targets = items.filter((i: QueueItemWithId) => i.tournamentId === tournamentId && i.status === 'pending_review');
    setProcessing('bulk-' + tournamentId, true);
    try {
      await Promise.all(
        targets.map((t) =>
          updateDoc(doc(db, 'marketing_queue', t.id), {
            status: 'approved',
            approvedBy: 'admin',
            approvedAt: new Date().toISOString(),
          })
        )
      );
      toast({ title: `Approved ${targets.length} captions`, description: 'All locales for tournament marked approved.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Bulk approve failed', description: (e as Error).message });
    } finally {
      setProcessing('bulk-' + tournamentId, false);
    }
  };

  const copyCaption = async (caption: string) => {
    try {
      await navigator.clipboard.writeText(caption);
      toast({ title: 'Copied to clipboard' });
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed' });
    }
  };

  const formatDate = (ts: QueueItemWithId['generatedAt']) => {
    if (!ts) return '—';
    if (typeof ts === 'string') return new Date(ts).toLocaleString();
    if ('seconds' in ts) return new Date(ts.seconds * 1000).toLocaleString();
    return '—';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-primary uppercase tracking-[0.2em]">Marketing Review</p>
          <h1 className="text-4xl font-headline font-bold uppercase tracking-tighter leading-none">Caption Queue</h1>
          <p className="text-muted-foreground font-medium mt-1">
            Approve, reject, or edit AI-generated captions before they go live.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RotateCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/30 border-white/5">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pending</p>
            <p className="text-3xl font-headline font-bold text-amber-400">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/30 border-white/5">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Approved</p>
            <p className="text-3xl font-headline font-bold text-emerald-400">{stats.approved}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/30 border-white/5">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Rejected</p>
            <p className="text-3xl font-headline font-bold text-rose-400">{stats.rejected}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/30 border-white/5">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total in view</p>
            <p className="text-3xl font-headline font-bold text-white">{stats.total}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-card/30 border-white/5">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <Input
                placeholder="Search tournament or caption text…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-secondary/30"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-secondary/30">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={localeFilter} onValueChange={setLocaleFilter}>
              <SelectTrigger className="bg-secondary/30">
                <SelectValue placeholder="Locale" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locales</SelectItem>
                <SelectItem value="tr">🇹🇷 Turkish</SelectItem>
                <SelectItem value="en">🇬🇧 English</SelectItem>
                <SelectItem value="el">🇬🇷 Greek</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* List grouped by tournament */}
      {loading ? (
        <Card className="bg-card/30 border-white/5">
          <CardContent className="p-12 text-center">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">Loading queue…</p>
          </CardContent>
        </Card>
      ) : grouped.length === 0 ? (
        <Card className="bg-card/30 border-white/5">
          <CardContent className="p-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-lg font-bold">Queue is empty</p>
            <p className="text-sm text-muted-foreground mt-1">
              {statusFilter === 'pending_review'
                ? 'No pending captions. Marketing bot will generate more at 09:00 daily.'
                : 'No items match the current filters.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([tournamentId, group]) => (
            <Card key={tournamentId} className="bg-card/30 border-white/5 overflow-hidden">
              <CardHeader className="border-b border-white/5 bg-card/40">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center text-primary">
                      <Trophy className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{group[0].tournamentName}</CardTitle>
                      <CardDescription className="text-xs flex items-center gap-2 mt-1">
                        <span className="capitalize">{group[0].sport}</span>
                        <span>•</span>
                        <Calendar className="h-3 w-3" />
                        <span>{group[0].startDate || 'Date TBD'}</span>
                        <span>•</span>
                        <span>{group.length} caption{group.length !== 1 ? 's' : ''}</span>
                      </CardDescription>
                    </div>
                  </div>
                  {group.some((i) => i.status === 'pending_review') && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                      onClick={() => handleBulkApprove(tournamentId)}
                      disabled={processingIds.has('bulk-' + tournamentId)}
                    >
                      {processingIds.has('bulk-' + tournamentId) ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <CheckCheck className="h-3 w-3 mr-1" />
                      )}
                      Approve all
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-white/5">
                  {group.map((item) => {
                    const isEditing = editingId === item.id;
                    const isProcessing = processingIds.has(item.id);
                    return (
                      <div key={item.id} className="p-4 hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-start gap-3">
                          <Badge variant="outline" className={LOCALE_COLORS[item.locale] + ' shrink-0'}>
                            {LOCALE_LABELS[item.locale]}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <Textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="bg-background/50 min-h-[80px]"
                              />
                            ) : (
                              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                {item.caption}
                              </p>
                            )}
                            <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-2 flex-wrap">
                              <span>Generated {formatDate(item.generatedAt)}</span>
                              <span>•</span>
                              <span className="font-mono">{item.model}</span>
                              {item.approvedAt && (
                                <>
                                  <span>•</span>
                                  <span>Decision {formatDate(item.approvedAt)}</span>
                                </>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {item.status === 'pending_review' ? (
                              <>
                                {isEditing ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="default"
                                      onClick={() => {
                                        handleApprove(item, editText);
                                        setEditingId(null);
                                      }}
                                      disabled={isProcessing}
                                    >
                                      <Check className="h-3 w-3 mr-1" /> Save
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button size="sm" variant="ghost" onClick={() => copyCaption(item.caption)} title="Copy">
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => { setEditingId(item.id); setEditText(item.caption); }} title="Edit">
                                      <Sparkles className="h-3 w-3" />
                                    </Button>
                                    <Button size="sm" variant="default" className="bg-emerald-600 hover:bg-emerald-500" onClick={() => handleApprove(item)} disabled={isProcessing}>
                                      {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                    </Button>
                                    <Button size="sm" variant="ghost" className="text-rose-400" onClick={() => handleReject(item)} disabled={isProcessing}>
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </>
                                )}
                              </>
                            ) : (
                              <Badge variant="outline" className={STATUS_OPTIONS.find((s) => s.value === item.status)?.color}>
                                {item.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
