/** Copies the reviewers' sample into the caller's account and opens it. */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui'
import { callAction } from '@/lib/call-action'

export function TrySampleButton({ variant = 'outline' }: { variant?: ButtonProps['variant'] }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function copy() {
    setBusy(true)
    setError('')
    const res = await callAction<{ decisionId: string }>('copySample', {})
    setBusy(false)
    if (res.success) navigate(`/decisions/${res.data.decisionId}`)
    else setError(res.error)
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button variant={variant} onClick={copy} loading={busy} disabled={busy}>
        <Sparkles /> Try a ready-made example
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  )
}
