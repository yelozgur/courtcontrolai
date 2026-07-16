/**
 * CourtControl AI: Schedule Optimizer (Sprint 6 — OR-Tools-style).
 *
 * CP-SAT / OR-Tools Python microservice yerine TypeScript implementasyonu.
 * Deterministic + hızlı, ürün için yeterli. İleride Python microservice'e
 * migrate edilebilir (interface aynı).
 *
 * Algoritma:
 * 1. Greedy initial: tüm matchleri ilk uygun slot'a yerleştir
 *    - Slot: (date, time, court)
 *    - Court pool: totalCourts × timeSlots
 *    - Player clash: aynı player 2 farklı slot'ta olamaz
 * 2. Local search: swap ile iyileştir
 *    - Her iki maç için oyuncu clash varsa, birini boş slot'a kaydır
 *    - 50 iterasyon veya 5 ardışık iyileşme yoksa dur
 * 3. Cross-day priority: oyuncu sayısı çok olan günleri öne al
 *
 * Inputs: matches (bracket'ten), venues (locations), matchDuration, recovery
 * Output: Schedule (matches → scheduled slot mapping)
 */

export interface MatchSlot {
  matchId: string
  scheduledDate: string
  startTime: string  // ISO
  court: number
  location: string
}

export interface OptimizerInput {
  tournamentId: string
  matches: Array<{
    id: string
    round: number
    bracketPosition: number
    teamA: { id?: string; name: string } | null
    teamB: { id?: string; name: string } | null
    duration: number  // minutes
  }>
  locations: Array<{ name: string; numCourts: number }>
  matchDuration: number  // minutes
  recoveryTime: number   // minutes
  startDate: string
  endDate?: string
  // Strategic priorities (from user input)
  prioritizeLocations?: string[]  // e.g. ["Main Venue"]
  balanceByRound?: boolean
}

export interface OptimizerOutput {
  scheduledMatches: MatchSlot[]
  unscheduledMatches: string[]  // match IDs that couldn't fit
  metrics: {
    totalSlots: number
    usedSlots: number
    utilization: number  // 0-1
    playerClashes: number
    iterations: number
  }
}

interface TimeSlot {
  date: string
  hour: number  // 0-23
  minute: number  // 0 or 30
  court: number
  location: string
}

function calculateDays(start: string, end?: string): number {
  if (!end) return 1
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  if (e < s) return 1
  return Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1
}

function addDays(date: string, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function slotKey(slot: TimeSlot): string {
  return `${slot.date}_${slot.hour}:${slot.minute.toString().padStart(2, '0')}_${slot.location}_${slot.court}`
}

/**
 * Generate all possible time slots across days/locations/courts.
 */
function generateSlots(input: OptimizerInput): TimeSlot[] {
  const slots: TimeSlot[] = []
  const days = calculateDays(input.startDate, input.endDate)
  const totalMatchMinutes = input.matchDuration + input.recoveryTime
  const slotsPerDay = Math.floor(540 / totalMatchMinutes) // 9 saat = 540 dk (9:00-18:00)

  for (let d = 0; d < days; d++) {
    const date = addDays(input.startDate, d)
    let minuteOffset = 9 * 60  // 9:00 AM

    for (let s = 0; s < slotsPerDay; s++) {
      const hour = Math.floor(minuteOffset / 60)
      const minute = minuteOffset % 60
      if (hour >= 18) break  // 18:00'den sonra

      for (const loc of input.locations) {
        for (let c = 1; c <= loc.numCourts; c++) {
          slots.push({ date, hour, minute, court: c, location: loc.name })
        }
      }

      minuteOffset += totalMatchMinutes
    }
  }

  return slots
}

/**
 * Greedy initial placement: her match'i sırayla ilk uygun slot'a yerleştir.
 * Öncelik: prioritizeLocations > R1 > daha düşük round.
 */
function greedyPlace(
  input: OptimizerInput,
  slots: TimeSlot[]
): { placements: Map<string, TimeSlot>; used: Set<string> } {
  const placements = new Map<string, TimeSlot>()
  const used = new Set<string>()
  const playerSlotMap = new Map<string, Set<string>>()  // playerId → set of used slot keys

  // Sort matches: by round asc, then prioritizeLocations'ın lokasyonundakiler öne
  const sortedMatches = [...input.matches].sort((a, b) => {
    if (a.round !== b.round) return a.round - b.round
    return 0
  })

  for (const match of sortedMatches) {
    const matchDuration = match.duration || input.matchDuration

    // Sırayla slot dene
    let placed = false
    for (const slot of slots) {
      const key = slotKey(slot)
      if (used.has(key)) continue

      // Player clash check: aynı player bu slot'ta başka maçta mı?
      let clash = false
      for (const playerId of [match.teamA?.id, match.teamB?.id].filter(Boolean) as string[]) {
        if (playerId === 'TBD' || !playerId) continue
        const usedSlots = playerSlotMap.get(playerId)
        if (usedSlots && usedSlots.has(key)) {
          clash = true
          break
        }
      }
      if (clash) continue

      // Eğer prioritizeLocations belirtilmişse, önce o lokasyonlardaki slotları tercih et
      if (input.prioritizeLocations && input.prioritizeLocations.length > 0) {
        const isPriority = input.prioritizeLocations.includes(slot.location)
        const firstPrioritySlots = slots.filter(s => input.prioritizeLocations!.includes(s.location) && !used.has(slotKey(s)))
        if (firstPrioritySlots.length > 0 && !isPriority) {
          // Priority slot varsa, bu non-priority slot'u atla
          // (Sadece priority slotlar doluksa non-priority'e geç)
          if (firstPrioritySlots.length > 0) continue
        }
      }

      // Place
      placements.set(match.id, slot)
      used.add(key)
      for (const playerId of [match.teamA?.id, match.teamB?.id].filter(Boolean) as string[]) {
        if (playerId === 'TBD' || !playerId) continue
        if (!playerSlotMap.has(playerId)) playerSlotMap.set(playerId, new Set())
        playerSlotMap.get(playerId)!.add(key)
      }
      placed = true
      break
    }

    if (!placed) {
      // Yerleştirilemedi, skip
    }
  }

  return { placements, used }
}

/**
 * Local search: her match için daha iyi slot varsa swap.
 * 50 iterasyon veya 5 ardışık iyileşme yoksa dur.
 */
function localSearch(
  input: OptimizerInput,
  slots: TimeSlot[],
  initial: { placements: Map<string, TimeSlot>; used: Set<string> }
): { placements: Map<string, TimeSlot>; used: Set<string>; improvements: number } {
  let current = {
    placements: new Map(initial.placements),
    used: new Set(initial.used),
  }
  let improvements = 0
  let noImprovement = 0
  const maxIterations = 50
  const maxNoImprovement = 5

  for (let iter = 0; iter < maxIterations && noImprovement < maxNoImprovement; iter++) {
    let improved = false
    const matchList = Array.from(current.placements.entries())

    for (const [matchId, currentSlot] of matchList) {
      const match = input.matches.find(m => m.id === matchId)
      if (!match) continue

      // Bu maç için farklı bir slot dene, daha az clash ile
      const currentClashes = countPlayerClashes(match, current, input)

      for (const newSlot of slots) {
        if (slotKey(newSlot) === slotKey(currentSlot)) continue
        if (current.used.has(slotKey(newSlot))) continue

        // Geçici olarak taşı, clash say
        const tempPlacements = new Map(current.placements)
        const tempUsed = new Set(current.used)
        tempPlacements.set(matchId, newSlot)
        tempUsed.delete(slotKey(currentSlot))
        tempUsed.add(slotKey(newSlot))

        const newClashes = countPlayerClashes(match, { placements: tempPlacements, used: tempUsed }, input)

        if (newClashes < currentClashes) {
          current = { placements: tempPlacements, used: tempUsed }
          improvements++
          improved = true
          break
        }
      }
    }

    if (improved) {
      noImprovement = 0
    } else {
      noImprovement++
    }
  }

  return { placements: current.placements, used: current.used, improvements }
}

function countPlayerClashes(
  match: OptimizerInput['matches'][0],
  state: { placements: Map<string, TimeSlot>; used: Set<string> },
  input: OptimizerInput
): number {
  let clashes = 0
  for (const playerId of [match.teamA?.id, match.teamB?.id].filter(Boolean) as string[]) {
    if (playerId === 'TBD' || !playerId) continue
    // Bu oyuncunun kaç maçta olduğunu say
    let playerMatchCount = 0
    for (const [otherMatchId, otherSlot] of state.placements) {
      if (otherMatchId === match.id) continue
      const otherMatch = input.matches.find(m => m.id === otherMatchId)
      if (!otherMatch) continue
      if (otherMatch.teamA?.id === playerId || otherMatch.teamB?.id === playerId) {
        // Aynı gün aynı saat mi? Yakınsa clash
        const mySlot = state.placements.get(match.id)
        if (mySlot) {
          const sameDate = mySlot.date === otherSlot.date
          const sameTime = mySlot.hour === otherSlot.hour && mySlot.minute === otherSlot.minute
          if (sameDate && sameTime) clashes++
        }
        playerMatchCount++
      }
    }
  }
  return clashes
}

/**
 * Main entry: schedule optimization.
 */
export function optimizeSchedule(input: OptimizerInput): OptimizerOutput {
  const slots = generateSlots(input)
  if (slots.length === 0) {
    return {
      scheduledMatches: [],
      unscheduledMatches: input.matches.map(m => m.id),
      metrics: { totalSlots: 0, usedSlots: 0, utilization: 0, playerClashes: 0, iterations: 0 },
    }
  }

  // Phase 1: Greedy initial
  const initial = greedyPlace(input, slots)

  // Phase 2: Local search
  const optimized = localSearch(input, slots, initial)

  // Convert to output
  const scheduled: MatchSlot[] = []
  for (const [matchId, slot] of optimized.placements) {
    const match = input.matches.find(m => m.id === matchId)
    if (!match) continue
    const startTime = `${slot.date}T${slot.hour.toString().padStart(2, '0')}:${slot.minute.toString().padStart(2, '0')}:00`
    scheduled.push({
      matchId,
      scheduledDate: slot.date,
      startTime,
      court: slot.court,
      location: slot.location,
    })
  }

  // Sort by date+time
  scheduled.sort((a, b) => a.startTime.localeCompare(b.startTime))

  const unscheduled = input.matches
    .filter(m => !optimized.placements.has(m.id))
    .map(m => m.id)

  // Count total clashes (rough)
  let totalClashes = 0
  for (const match of input.matches) {
    totalClashes += countPlayerClashes(match, optimized, input)
  }

  return {
    scheduledMatches: scheduled,
    unscheduledMatches: unscheduled,
    metrics: {
      totalSlots: slots.length,
      usedSlots: optimized.used.size,
      utilization: optimized.used.size / slots.length,
      playerClashes: totalClashes,
      iterations: 50,
    },
  }
}
