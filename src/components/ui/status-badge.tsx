
import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type StatusType = 
  | "active" 
  | "registration_open" 
  | "registration_closed" 
  | "in_progress" 
  | "completed" 
  | "draft" 
  | "upcoming" 
  | "pending" 
  | "live" 
  | "scheduled" 
  | "archived"

interface StatusBadgeProps {
  status: StatusType
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const styles: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    registration_open: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    registration_closed: "bg-slate-500/10 text-slate-500 border-slate-500/20",
    in_progress: "bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse",
    completed: "bg-slate-500/10 text-slate-500 border-slate-500/20",
    draft: "bg-slate-500/10 text-slate-500 border-slate-500/20 opacity-60",
    archived: "bg-red-500/10 text-red-500 border-red-500/20 grayscale",
    live: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 animate-pulse",
    scheduled: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  }

  const label = status?.replace('_', ' ') || "unknown"

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "uppercase tracking-widest text-[10px] font-bold py-0.5 px-2", 
        styles[status] || styles.draft, 
        className
      )}
    >
      {label}
    </Badge>
  )
}
