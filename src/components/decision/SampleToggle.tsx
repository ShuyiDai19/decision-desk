/**
 * Owner-only control: make this decision the reviewers' sample. Hidden for
 * everyone who isn't allowed to set it (see actions/sample.ts).
 */

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Badge, Button } from '@/components/ui'
import { callAction } from '@/lib/call-action'
import { useAppInfo } from '@/lib/use-app-info'

export function SampleToggle({ decisionId, isSample, hasResearch }: { decisionId: string; isSample: boolean; hasResearch: boolean }) {
  const { info } = useAppInfo(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (isSample) {
    return (
      <Badge variant="info" size="sm" title="Signed-in visitors can copy this decision from their home page.">
        Reviewers&apos; sample
      </Badge>
    )
  }
  if (!info?.canManageSample || !hasResearch) return null

  async function mark() {
    setBusy(true)
    setError('')
    const res = await callAction('markAsSample', { decisionId })
    setBusy(false)
    if (!res.success) setError(res.error)
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button size="sm" variant="ghost" onClick={mark} loading={busy} disabled={busy} title="Visitors get their own copy; this one stays yours.">
        <Sparkles /> Use as the reviewers&apos; sample
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  )
}
