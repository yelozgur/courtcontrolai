"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Plus, Loader2, MapPin, Trash2, Edit, ChevronRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useI18n } from "@/i18n/I18nProvider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Court {
  id: string
  name: string
  order: number
}

interface Venue {
  id: string
  name: string
  openHours: Record<string, string[][]> | null
  courts: Court[]
}

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const
const WEEKDAY_LABELS: Record<string, { en: string; tr: string }> = {
  mon: { en: "Monday", tr: "Pazartesi" },
  tue: { en: "Tuesday", tr: "Salı" },
  wed: { en: "Wednesday", tr: "Çarşamba" },
  thu: { en: "Thursday", tr: "Perşembe" },
  fri: { en: "Friday", tr: "Cuma" },
  sat: { en: "Saturday", tr: "Cumartesi" },
  sun: { en: "Sunday", tr: "Pazar" },
}

export default function VenuesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { t, locale } = useI18n()

  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Venue | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchVenues = useCallback(async () => {
    try {
      const res = await fetch("/api/venues")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setVenues(data)
    } catch (err) {
      console.error("Failed to fetch venues:", err)
      toast({ title: t("common.error"), description: String(err), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast, t])

  useEffect(() => {
    fetchVenues()
  }, [fetchVenues])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const venue = await res.json()
      setVenues((prev) => [...prev, venue])
      setCreateOpen(false)
      setNewName("")
      toast({ title: t("venue.created") })
    } catch (err) {
      toast({ title: t("common.error"), description: String(err), variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/venues/${deleteTarget.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setVenues((prev) => prev.filter((v) => v.id !== deleteTarget.id))
      setDeleteTarget(null)
      toast({ title: t("venue.deleted") })
    } catch (err) {
      toast({ title: t("common.error"), description: String(err), variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const formatOpenHours = (oh: Record<string, string[][]> | null) => {
    if (oh === null) return t("venue.openHours.null")
    const entries = Object.entries(oh)
    if (entries.length === 0) return t("venue.openHours.closed")
    return WEEKDAYS
      .filter((day) => oh[day])
      .map((day) => {
        const label = WEEKDAY_LABELS[day]?.[locale as "en" | "tr"] ?? WEEKDAY_LABELS[day]?.tr ?? day
        const ranges = oh[day].map((r) => r.join("–")).join(", ")
        return `${label}: ${ranges}`
      })
      .join("; ")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold">{t("venue.venues")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {venues.length} {t("venue.court")}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("venue.new")}
        </Button>
      </div>

      {venues.length === 0 ? (
        <Card className="bg-card/50 border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-bold mb-2">{t("venue.noVenues")}</h3>
            <p className="text-sm text-muted-foreground mb-6">{t("venue.noVenuesDesc")}</p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t("venue.create")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {venues.map((venue) => (
            <Card
              key={venue.id}
              className="bg-card/50 border-border hover:bg-card/70 transition-colors cursor-pointer"
              onClick={() => router.push(`/dashboard/venues/${venue.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <MapPin className="h-5 w-5 text-primary shrink-0" />
                      <h3 className="text-lg font-bold truncate">{venue.name}</h3>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <Badge variant="outline">
                        {venue.courts.length} {t("venue.court")}
                      </Badge>
                      <span className="truncate text-xs">{formatOpenHours(venue.openHours)}</span>
                    </div>
                    {venue.courts.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {venue.courts.map((court) => (
                          <Badge key={court.id} variant="secondary" className="text-xs">
                            {court.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget(venue)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("venue.new")}</DialogTitle>
            <DialogDescription>{t("venue.noVenuesDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("venue.name")}</Label>
              <Input
                placeholder={t("venue.name")}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("venue.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("venue.deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("venue.deleteConfirmDesc")}
              <br />
              <br />
              <strong>{t("venue.cascadeWarning")}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              {t("venue.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
