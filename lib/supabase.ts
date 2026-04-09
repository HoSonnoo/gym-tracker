import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

export const SUPABASE_URL = 'https://xttmvtgkoshsfyqmizja.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dG12dGdrb3Noc2Z5cW1pemphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MDk5MjUsImV4cCI6MjA4OTQ4NTkyNX0.3ooDzd5rLe8GeJ1sLWkpKSjp_D5TAey_acThZN_2WiU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});