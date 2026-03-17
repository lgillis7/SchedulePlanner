import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

/**
 * Creates a Supabase browser client that uses the editor JWT
 * for write access. The Authorization header overrides the anon key,
 * satisfying RLS policies that check auth.role() = 'authenticated'.
 */
export function createEditorClient(editorToken: string) {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${editorToken}`,
        },
      },
    }
  );
}
