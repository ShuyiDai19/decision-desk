/**
 * Calls a server action at POST /api/actions/:name with the user's token.
 * Returns the action's own { success, data | error } shape; network and
 * auth failures are folded into the same shape so callers handle one case.
 */

import { getAuthToken } from 'deepspace'

export type ActionResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string; details?: { fieldErrors?: Record<string, string> } }

export async function callAction<T>(name: string, params: Record<string, unknown>): Promise<ActionResponse<T>> {
  try {
    const token = await getAuthToken()
    if (!token) return { success: false, error: 'Please sign in again.', code: 'unauthenticated' }
    const res = await fetch(`/api/actions/${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(params),
    })
    if (res.status === 401) return { success: false, error: 'Please sign in again.', code: 'unauthenticated' }
    return (await res.json()) as ActionResponse<T>
  } catch {
    return { success: false, error: 'Could not reach the server. Check your connection and try again.' }
  }
}
