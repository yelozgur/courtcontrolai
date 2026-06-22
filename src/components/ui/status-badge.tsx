import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type StatusType = "active" | "registration" | "completed" | "draft" | "upcoming" | "pending" | "live" | "scheduled"

interface StatusBadgeProps {
  status: StatusType
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const styles: Record<StatusType, string> = {
    active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    live: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 animate-pulse",
    registration: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    upcoming: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    scheduled: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    completed: "bg-slate-500/10 text-slate-500 border-slate-500/20",
    draft: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  }

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "uppercase tracking-widest text-[10px] font-bold py-0.5 px-2", 
        styles[status] || styles.draft, 
        className
      )}
    >
      {status}
    </Badge>
  )
}
