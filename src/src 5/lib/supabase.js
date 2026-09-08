import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// Admins log in with a username, not an email. Supabase Auth still needs an
// email internally, so we generate one deterministically from the username
// and never show it in the UI.
export const AUTH_DOMAIN = 'edenplus.local'
export const usernameToEmail = (username) =>
  `${username.trim().toLowerCase()}@${AUTH_DOMAIN}`
