"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Save, Loader2, ArrowLeft, Plus, Trash2, GripVertical, Clock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useI18n } from "@/i18n/I18nProvider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Court {
  id?: string
  name: string
  order: number
}

interface VenueData {
  id: string
  name: string
  openHours: Record<string, string[][]> | null
  courts: Court[]
}

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
const WEEKDAY_LABELS: Record<string, { en: string; tr: string }> = {
  mon: { en: "Monday", tr: "Pazartesi" },
  tue: { en: "Tuesday", tr: "Salı" },
  wed: { en: "Wednesday", tr: "Çarşamba" },
  thu: { en: "Thursday", tr: "Perşembe" },
  fri: { en: "Friday", tr: "Cuma" },
  sat: { en: "Saturday", tr: "Cumartesi" },
  sun: { en: "Sunday", tr: "Pazar" },
}

type OpenHoursMode = "null" | "closed" | "custom"

function getOpenHoursMode(oh: Record<string, string[][]> | null): OpenHoursMode {
  if (oh === null) return "null"
  if (Object.keys(oh).length === 0) return "closed"
  return "custom"
}

export default function VenueEditPage() {
  const { id } = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { t, locale } = useI18n()

  const [venue, setVenue] = useState<VenueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [courts, setCourts] = useState<Court[]>([])
  const [openHoursMode, setOpenHoursMode] = useState<OpenHoursMode>("null")
  const [openHours, setOpenHours] = useState<Record<string, string[][]>>({})
  const [dirty, setDirty] = useState(false)

  const fetchVenue = useCallback(async () => {
    try {
      const res = await fetch(`/api/venues/${id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: VenueData = await res.json()
      setVenue(data)
      setName(data.name)
      setCourts(data.courts.map((c, i) => ({ ...c, order: c.order ?? i })))
      const mode = getOpenHoursMode(data.openHours)
      setOpenHoursMode(mode)
      setOpenHours(mode === "custom" ? (data.openHours as Record<string, string[][]>) : {})
    } catch (err) {
      console.error("Failed to fetch venue:", err)
      toast({ title: t("common.error"), description: String(err), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [id, toast, t])

  useEffect(() => {
    fetchVenue()
  }, [fetchVenue])

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: t("venue.nameRequired"), variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      let payloadOpenHours: Record<string, string[][]> | null
      if (openHoursMode === "null") {
        payloadOpenHours = null
      } else if (openHoursMode === "closed") {
        payloadOpenHours = {}
      } else {
        payloadOpenHours = openHours
      }

      const res = await fetch(`/api/venues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          openHours: payloadOpenHours,
          courts: courts.map((c, i) => ({ id: c.id, name: c.name, order: c.order ?? i })),
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const updated = await res.json()
      setVenue(updated)
      setCourts(updated.courts.map((c: Court, i: number) => ({ ...c, order: c.order ?? i })))
      setDirty(false)
      toast({ title: t("venue.saved") })
    } catch (err) {
      toast({ title: t("common.error"), description: String(err), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const addCourt = () => {
    const nextOrder = courts.length > 0 ? Math.max(...courts.map((c) => c.order)) + 1 : 0
    setCourts([...courts, { name: `${t("venue.court")} ${courts.length + 1}`, order: nextOrder }])
    setDirty(true)
  }

  const updateCourt = (index: number, updates: Partial<Court>) => {
    setCourts((prev) => prev.map((c, i) => (i === index ? { ...c, ...updates } : c)))
    setDirty(true)
  }

  const removeCourt = (index: number) => {
    setCourts((prev) => prev.filter((_, i) => i !== index))
    setDirty(true)
  }

  const moveCourt = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= courts.length) return
    setCourts((prev) => {
      const next = [...prev]
      const tmp = next[index]
      next[index] = next[newIndex]
      next[newIndex] = tmp
      return next.map((c, i) => ({ ...c, order: i }))
    })
    setDirty(true)
  }

  const handleModeChange = (mode: OpenHoursMode) => {
    setOpenHoursMode(mode)
    if (mode === "custom" && Object.keys(openHours).length === 0) {
      const initial: Record<string, string[][]> = {}
      WEEKDAYS.forEach((d) => { initial[d] = [] })
      setOpenHours(initial)
    }
    setDirty(true)
  }

  const addTimeRange = (day: string) => {
    setOpenHours((prev) => ({
      ...prev,
      [day]: [...(prev[day] || []), ["09:00", "18:00"]],
    }))
    setDirty(true)
  }

  const updateTimeRange = (day: string, rangeIndex: number, which: 0 | 1, value: string) => {
    setOpenHours((prev) => {
      const ranges = [...(prev[day] || [])]
      const range = [...ranges[rangeIndex]]
      range[which] = value
      ranges[rangeIndex] = range
      return { ...prev, [day]: ranges }
    })
    setDirty(true)
  }

  const removeTimeRange = (day: string, rangeIndex: number) => {
    setOpenHours((prev) => ({
      ...prev,
      [day]: (prev[day] || []).filter((_, i) => i !== rangeIndex),
    }))
    setDirty(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!venue) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">{t("error.notFound")}</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/venues")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-headline font-bold">{t("venue.edit")}</h1>
            <Badge variant="outline">{venue.name}</Badge>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving || !dirty}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {t("venue.save")}
        </Button>
      </div>

      <Tabs defaultValue="courts" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-secondary/30 mb-8 p-1">
          <TabsTrigger value="courts">{t("venue.manageCourts")}</TabsTrigger>
          <TabsTrigger value="hours">{t("venue.openHours")}</TabsTrigger>
        </TabsList>

        <TabsContent value="courts" className="space-y-6">
          <Card className="bg-card/50 border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("venue.settings")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("venue.name")}</Label>
                <Input
                  value={name}
                  onChange={(e) => { setName(e.target.value); setDirty(true) }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("venue.courts")} ({courts.length})</CardTitle>
                <Button size="sm" onClick={addCourt}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("venue.addCourt")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {courts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t("venue.noVenuesDesc")}
                </p>
              ) : (
                courts.map((court, index) => (
                  <div key={court.id ?? index} className="flex items-center gap-3 p-3 bg-secondary/20 rounded-xl">
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={index === 0}
                        onClick={() => moveCourt(index, -1)}
                      >
                        <GripVertical className="h-3 w-3 rotate-90" />
                      </Button>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      #{index + 1}
                    </Badge>
                    <Input
                      value={court.name}
                      onChange={(e) => updateCourt(index, { name: e.target.value })}
                      className="flex-1"
                      placeholder={t("venue.courtName")}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:text-destructive shrink-0"
                      onClick={() => removeCourt(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hours" className="space-y-6">
          <Card className="bg-card/50 border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {t("venue.openHours")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>{t("venue.openHours.weekday")}</Label>
                <Select value={openHoursMode} onValueChange={(v) => handleModeChange(v as OpenHoursMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="null">{t("venue.openHours.null")}</SelectItem>
                    <SelectItem value="closed">{t("venue.openHours.closed")}</SelectItem>
                    <SelectItem value="custom">{t("venue.openHours.custom")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {openHoursMode === "custom" && (
                <div className="space-y-4">
                  {WEEKDAYS.map((day) => {
                    const ranges = openHours[day] || []
                    const label = WEEKDAY_LABELS[day]?.[locale] || day
                    return (
                      <div key={day} className="p-4 bg-secondary/20 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-bold">{label}</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => addTimeRange(day)}
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            {t("venue.openHours.addRange")}
                          </Button>
                        </div>
                        {ranges.length === 0 ? (
                          <p className="text-xs text-muted-foreground">—</p>
                        ) : (
                          ranges.map((range, ri) => (
                            <div key={ri} className="flex items-center gap-2">
                              <Input
                                type="time"
                                value={range[0]}
                                onChange={(e) => updateTimeRange(day, ri, 0, e.target.value)}
                                className="w-32"
                              />
                              <span className="text-muted-foreground">–</span>
                              <Input
                                type="time"
                                value={range[1]}
                                onChange={(e) => updateTimeRange(day, ri, 1, e.target.value)}
                                className="w-32"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:text-destructive"
                                onClick={() => removeTimeRange(day, ri)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {openHoursMode === "null" && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("venue.openHours.null")}
                </p>
              )}

              {openHoursMode === "closed" && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("venue.openHours.closed")}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
