/** Whether a reviewers' sample exists and whether the caller may set it (from the appInfo action). */

import { useEffect, useState } from 'react'
import { callAction } from './call-action'

export type AppInfo = { hasSample: boolean; sampleQuestion: string; canManageSample: boolean }

export function useAppInfo(enabled: boolean) {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    callAction<AppInfo>('appInfo', {}).then((res) => {
      if (!cancelled && res.success) setInfo(res.data)
    })
    return () => {
      cancelled = true
    }
  }, [enabled, version])
  return { info, refresh: () => setVersion((v) => v + 1) }
}
