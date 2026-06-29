import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tmyarrsojkkpmzuzsxio.supabase.co'
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRteWFycnNvamtrcG16dXpzeGlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NjQ2MTYsImV4cCI6MjA5NzA0MDYxNn0.-IgHV2UijOtBT87dIxY2rWi9bmzcz5QpNBea8DNwXhs'

export const SUPABASE_DOCUMENT_ID = 'form-studio-data'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
