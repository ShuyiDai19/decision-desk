/**
 * GET /api/shared/:token: the one public way to read a snapshot.
 *
 * No sign-in needed: having the link is the permission. Returns a single
 * snapshot for a valid token and 404 for anything else, with the same body
 * either way so the response doesn't reveal whether a token ever existed.
 * Reads as the app owner (the snapshots collection is owner-only for
 * everyone else); src/lib/share.ts decides what may be returned.
 */

import type { Hono } from 'hono'
import { buildCronContext } from 'deepspace/worker'
import { loadSharedSnapshot } from '../lib/share'
import type { AppContext } from '../../worker.js'

export function registerShareRoutes(app: Hono<AppContext>): void {
  app.get('/api/shared/:token', async (c) => {
    const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }
    const records = buildCronContext(c.env, c.env.OWNER_USER_ID, `app:${c.env.DEEPSPACE_APP_ID}`).records
    const shared = await loadSharedSnapshot(records, c.req.param('token'))
    if (!shared) return c.json({ error: 'not_found' }, 404, headers)
    return c.json(shared, 200, headers)
  })
}
