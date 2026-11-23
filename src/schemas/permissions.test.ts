import { describe, expect, it } from 'vitest'
import { schemas } from '../schemas'

// The README and the share panel promise that only you can see your own
// decisions and snapshots. That has to hold for the app owner's account too,
// which gets the 'admin' role, so no app collection may give admin more than
// members.
const APP_COLLECTIONS = ['decisions', 'criteria', 'candidates', 'sources', 'claims', 'snapshots', 'usage', 'feedback']

describe('permissions', () => {
  for (const name of APP_COLLECTIONS) {
    it(`${name}: admin gets no more access than a member`, () => {
      const schema = schemas.find((s) => s.name === name)!
      expect(schema).toBeDefined()
      expect(schema.permissions.admin).toEqual(schema.permissions.member)
    })

    it(`${name}: signed-out visitors can read nothing`, () => {
      const schema = schemas.find((s) => s.name === name)!
      expect(schema.permissions['*'].read).toBe(false)
    })

    it(`${name}: browsers never create or delete rows`, () => {
      const schema = schemas.find((s) => s.name === name)!
      for (const role of ['viewer', 'member', 'admin']) {
        expect(schema.permissions[role].create).toBe(false)
        expect(schema.permissions[role].delete).toBe(false)
      }
    })
  }
})
