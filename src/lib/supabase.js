import { createClient } from '@supabase/supabase-js'
import { useSession } from '@clerk/vue'

let client = null

export function useSupabaseClient() {
  const { session } = useSession()
  if (!client) {
    client = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      {
        // accessToken is called per-request; reads the live session ref each time
        accessToken: async () => (await session.value?.getToken()) ?? null,
      },
    )
  }
  return client
}
