import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const AUTH_DOMAIN = 'edenplus.local'

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const callerToken = authHeader.replace('Bearer ', '')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // Client scoped to the caller's own token — used only to check who they are.
    const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: `Bearer ${callerToken}` } },
    })

    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser()

    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 })
    }

    // Admin client — has full service-role access, used for the actual work.
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: callerProfile } = await adminClient
      .from('admins')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (callerProfile?.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Only a super admin can add admins' }), {
        status: 403,
      })
    }

    const { name, username, password, role } = await req.json()

    if (!name || !username || !password) {
      return new Response(JSON.stringify({ error: 'Missing name, username, or password' }), {
        status: 400,
      })
    }

    const email = `${username.trim().toLowerCase()}@${AUTH_DOMAIN}`

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), { status: 400 })
    }

    const { error: insertError } = await adminClient.from('admins').insert({
      id: created.user.id,
      name,
      username: username.trim().toLowerCase(),
      email,
      role: role === 'super_admin' ? 'super_admin' : 'admin',
      created_by: caller.id,
    })

    if (insertError) {
      // Roll back the auth user so we don't leave an orphaned login.
      await adminClient.auth.admin.deleteUser(created.user.id)
      return new Response(JSON.stringify({ error: insertError.message }), { status: 400 })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
