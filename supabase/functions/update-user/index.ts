import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get JWT from authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract JWT token
    const jwt = authHeader.replace('Bearer ', '');
    
    // Create a Supabase client for checking user permissions
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify the authenticated user using the JWT
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(jwt);
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin using admin client to bypass RLS
    const { data: adminRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !adminRole) {
      console.error('Admin check error:', roleError);
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions. Admin role required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { userId, username, password, department, revokeAdmin } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Updating user:', userId);

    // Handle admin role revocation (only IT and Executive departments)
    if (revokeAdmin) {
      // Get the calling user's department
      const { data: callerProfile, error: callerError } = await supabaseAdmin
        .from('profiles')
        .select('department')
        .eq('id', user.id)
        .single();

      if (callerError || !callerProfile) {
        console.error('Error fetching caller profile:', callerError);
        return new Response(
          JSON.stringify({ error: 'Failed to verify caller permissions' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const callerDept = callerProfile.department.toLowerCase();
      if (callerDept !== 'it' && callerDept !== 'executive department') {
        return new Response(
          JSON.stringify({ error: 'Only IT and Executive departments can revoke admin privileges' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Revoke admin role
      const { error: revokeError } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'admin');

      if (revokeError) {
        console.error('Error revoking admin role:', revokeError);
        return new Response(
          JSON.stringify({ error: 'Failed to revoke admin privileges' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Admin role revoked successfully');
    }

    // Update password if provided
    if (password) {
      // Validate password (admins can set simple passwords, users will be required to change)
      if (password.length < 6) {
        return new Response(
          JSON.stringify({ error: 'Password must be at least 6 characters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (password.length > 128) {
        return new Response(
          JSON.stringify({ error: 'Password must be less than 128 characters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password }
      );

      if (passwordError) {
        console.error('Error updating password:', passwordError);
        return new Response(
          JSON.stringify({ error: passwordError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Password updated successfully');
    }

    // Update username if provided
    if (username) {
      // Validate username
      if (username.length < 3) {
        return new Response(
          JSON.stringify({ error: 'Username must be at least 3 characters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (username.length > 50) {
        return new Response(
          JSON.stringify({ error: 'Username must be less than 50 characters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        return new Response(
          JSON.stringify({ error: 'Username can only contain letters, numbers, hyphens, and underscores' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ username })
        .eq('id', userId);

      if (profileError) {
        console.error('Error updating username:', profileError);
        return new Response(
          JSON.stringify({ error: profileError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Username updated successfully');
    }

    // Update department if provided
    if (department) {
      // Validate department
      if (department.length < 1) {
        return new Response(
          JSON.stringify({ error: 'Department cannot be empty' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (department.length > 100) {
        return new Response(
          JSON.stringify({ error: 'Department must be less than 100 characters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: departmentError } = await supabaseAdmin
        .from('profiles')
        .update({ department })
        .eq('id', userId);

      if (departmentError) {
        console.error('Error updating department:', departmentError);
        return new Response(
          JSON.stringify({ error: departmentError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Department updated successfully');
    }

    return new Response(
      JSON.stringify({ success: true, message: 'User updated successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in update-user function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
