import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://piyhnqkxcuwijhcmwqlv.supabase.co'

const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpeWhucWt4Y3V3aWpoY213cWx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNDQ1MjcsImV4cCI6MjA5MzgyMDUyN30.10w80h1Oqx9X_g0E_31evtbHP6azDysCIFc3WPY6_b4'

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
)