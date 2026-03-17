import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Creates a Supabase client that uses the editor JWT
 * for write access. Uses supabase-js directly (not @supabase/ssr)
 * to avoid the singleton behavior of createBrowserClient.
 */
export function createEditorClient(editorToken: string) {
  return createClient<Database>(
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
