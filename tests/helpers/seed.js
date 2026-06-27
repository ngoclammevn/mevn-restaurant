import { admin } from './client.js'

// Insert profiles for test users via service role (bypasses RLS)
export async function seedProfiles(users) {
  await admin.from('profiles').upsert(users, { onConflict: 'id' })
}

// Clean up all test data between tests
export async function cleanAll() {
  await admin.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await admin.from('menus').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await admin.from('profiles').delete().neq('id', '')
}
