/**
 * Link sharing for snapshots.
 *
 * A shared snapshot is reachable only through an unguessable share token in
 * its link (/share/<token>). The snapshots collection itself is readable by
 * its owner only, so nobody can list or browse other people's decisions.
 * Turning sharing off clears the token; turning it on again issues a new one,
 * so old links stop working for good.
 */

/** 24 random bytes, base64url: 32 characters, 192 bits. */
export function generateShareToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Rejects anything that can't be a token before it reaches a query. */
export function isShareTokenShape(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{32}$/.test(token)
}

/** What a visitor with the link receives. No owner id, no internal fields. */
export type SharedSnapshot = {
  snapshotId: string
  version: number
  briefMarkdown: string
  payload: unknown
}

type Row = { recordId: string; data: Record<string, unknown> }
export interface ShareStore {
  query(collection: string, opts: { where: Record<string, unknown>; limit?: number }): Promise<unknown[]>
}

/**
 * Finds the one snapshot shared under `token`, or null. Checks the token's
 * shape first and re-checks the match and the sharing flag on the row, so a
 * store that ignored the filter could still not leak a different snapshot.
 */
export async function loadSharedSnapshot(store: ShareStore, token: unknown): Promise<SharedSnapshot | null> {
  if (!isShareTokenShape(token)) return null
  const rows = (await store.query('snapshots', { where: { shareToken: token }, limit: 2 })) as Row[]
  const row = rows.find((r) => r.data.shareToken === token && r.data.visibility === 'public')
  if (!row) return null
  return {
    snapshotId: row.recordId,
    version: Number(row.data.version),
    briefMarkdown: String(row.data.briefMarkdown ?? ''),
    payload: row.data.payload,
  }
}
