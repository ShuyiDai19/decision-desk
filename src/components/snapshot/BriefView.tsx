/** Renders a decision brief. Citations like [3] jump to that cell in the frozen table below. */

import type { Block, Inline, SnapshotClaim } from '@/lib/brief'

function InlineParts({ parts, claims }: { parts: Inline[]; claims: SnapshotClaim[] }) {
  return (
    <>
      {parts.map((p, i) => {
        if (p.kind === 'text') return <span key={i}>{p.text}</span>
        if (p.kind === 'bold') return <strong key={i}>{p.text}</strong>
        const exists = claims.some((c) => c.n === p.n)
        return exists ? (
          <a key={i} href={`#cell-${p.n}`} className="align-super text-[0.7em] text-primary hover:underline">
            [{p.n}]
          </a>
        ) : null
      })}
    </>
  )
}

export function BriefView({ blocks, claims }: { blocks: Block[]; claims: SnapshotClaim[] }) {
  const out: React.ReactNode[] = []
  let bullets: Block[] = []
  const flush = () => {
    if (bullets.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="ml-5 list-disc space-y-1">
          {bullets.map((b, i) => (
            <li key={i}>
              <InlineParts parts={b.inline} claims={claims} />
            </li>
          ))}
        </ul>,
      )
      bullets = []
    }
  }
  blocks.forEach((b, i) => {
    if (b.kind === 'bullet') {
      bullets.push(b)
      return
    }
    flush()
    out.push(
      b.kind === 'heading' ? (
        <h3 key={i} className="mt-4 text-base font-semibold first:mt-0">
          <InlineParts parts={b.inline} claims={claims} />
        </h3>
      ) : (
        <p key={i}>
          <InlineParts parts={b.inline} claims={claims} />
        </p>
      ),
    )
  })
  flush()
  return <div className="flex flex-col gap-2 leading-relaxed">{out}</div>
}
