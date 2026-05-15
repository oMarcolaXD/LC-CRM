"use client"

import { useState, useTransition } from "react"
import { Button }   from "@/components/ui/button"
import { Switch }   from "@/components/ui/switch"
import { Label }    from "@/components/ui/label"
import { DAY_NAMES, type Availability, type TimeSlot } from "@/lib/availability"
import { saveAvailabilityAction } from "./actions"
import { Plus, Trash2, Loader2, CheckCircle2 } from "lucide-react"

const EMPTY: TimeSlot = { start: "09:00", end: "18:00" }

export function AvailabilityForm({
  initial,
}: {
  initial: Availability
}) {
  const [avail,   setAvail]   = useState<Availability>(initial)
  const [saved,   setSaved]   = useState(false)
  const [pending, start]      = useTransition()

  const toggle = (day: string, enabled: boolean) => {
    setAvail((prev) => {
      const next = { ...prev }
      if (enabled) next[day] = [{ ...EMPTY }]
      else         delete next[day]
      return next
    })
    setSaved(false)
  }

  const addSlot = (day: string) => {
    setAvail((prev) => ({ ...prev, [day]: [...(prev[day] ?? []), { ...EMPTY }] }))
    setSaved(false)
  }

  const removeSlot = (day: string, idx: number) => {
    setAvail((prev) => {
      const slots = (prev[day] ?? []).filter((_, i) => i !== idx)
      const next  = { ...prev }
      if (slots.length === 0) delete next[day]
      else                    next[day] = slots
      return next
    })
    setSaved(false)
  }

  const updateSlot = (day: string, idx: number, field: keyof TimeSlot, value: string) => {
    setAvail((prev) => {
      const slots = [...(prev[day] ?? [])]
      slots[idx]  = { ...slots[idx], [field]: value }
      return { ...prev, [day]: slots }
    })
    setSaved(false)
  }

  const save = () => {
    start(async () => {
      await saveAvailabilityAction(avail)
      setSaved(true)
    })
  }

  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
        const key     = String(dow)
        const enabled = !!avail[key]
        const slots   = avail[key] ?? []

        return (
          <div key={dow} className={`rounded-xl border p-4 transition-colors ${enabled ? "border-primary/30 bg-primary/5" : "border-border"}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Switch checked={enabled} onCheckedChange={(v) => toggle(key, v)} />
                <Label className={`font-medium ${enabled ? "text-foreground" : "text-muted-foreground"}`}>
                  {DAY_NAMES[dow]}
                </Label>
              </div>
              {enabled && (
                <Button variant="ghost" size="sm" onClick={() => addSlot(key)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Intervalo
                </Button>
              )}
            </div>

            {enabled && slots.map((slot, idx) => (
              <div key={idx} className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time" value={slot.start}
                    onChange={(e) => updateSlot(key, idx, "start", e.target.value)}
                    className="flex h-9 rounded-lg border border-input bg-background px-3 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <span className="text-muted-foreground text-sm">até</span>
                  <input
                    type="time" value={slot.end}
                    onChange={(e) => updateSlot(key, idx, "end", e.target.value)}
                    className="flex h-9 rounded-lg border border-input bg-background px-3 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                {slots.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removeSlot(key, idx)}
                    className="text-destructive hover:bg-destructive/10 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}

            {!enabled && (
              <p className="text-xs text-muted-foreground">Indisponível</p>
            )}
          </div>
        )
      })}

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={save} disabled={pending}>
          {pending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Salvar Disponibilidade
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle2 className="w-4 h-4" /> Salvo!
          </span>
        )}
      </div>
    </div>
  )
}
