/** Delete a decision after confirming; says how many shared versions will stop working. */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { Button, ConfirmModal } from '@/components/ui'
import { callAction } from '@/lib/call-action'

type Props = { decisionId: string; question: string; snapshotCount: number; sharedCount: number; disabled?: boolean }

export function DeleteDecisionButton({ decisionId, question, snapshotCount, sharedCount, disabled }: Props) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function confirm() {
    setBusy(true)
    setError('')
    const res = await callAction('deleteDecision', { decisionId })
    setBusy(false)
    if (res.success) {
      setOpen(false)
      navigate('/home')
    } else {
      setOpen(false)
      setError(res.error)
    }
  }

  const versions =
    snapshotCount === 0
      ? ''
      : ` Its ${snapshotCount} saved ${snapshotCount === 1 ? 'version' : 'versions'} will be deleted too${
          sharedCount > 0 ? `, and ${sharedCount === 1 ? 'its shared link' : `${sharedCount} shared links`} will stop working` : ''
        }.`

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        size="sm"
        variant="ghost"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
        disabled={disabled || busy}
        title={disabled ? 'Wait for research to finish' : 'Delete this decision'}
      >
        <Trash2 /> Delete
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
      <ConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
        loading={busy}
        title="Delete this decision?"
        description={`“${question}” and its research, corrections and weights will be permanently deleted.${versions} This can’t be undone.`}
        confirmText="Delete permanently"
        cancelText="Keep it"
      />
    </span>
  )
}
