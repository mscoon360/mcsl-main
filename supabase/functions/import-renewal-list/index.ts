import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.user.id;

    // Expect pre-parsed contracts from client
    const { contracts } = await req.json();

    if (!contracts || !Array.isArray(contracts) || contracts.length === 0) {
      throw new Error("No contracts data provided");
    }

    console.log(`Received ${contracts.length} contracts to import`);

    // Add user_id to each contract
    const contractsWithUser = contracts.map((contract: any) => ({
      user_id: userId,
      client: contract.client,
      contract_start_date: contract.contract_start_date || null,
      contract_end_date: contract.contract_end_date || null,
      value_of_contract_vat: parseFloat(contract.value_of_contract_vat) || 0,
      type_of_billing: contract.type_of_billing || null,
      billed: contract.billed === true || contract.billed === 'yes',
      type_of_service: contract.type_of_service || null,
      zone: contract.zone || null,
      contact_number: contract.contact_number || null,
      email: contract.email || null,
      renewal_status: 'pending'
    }));

    // Insert contracts into database
    const { data: insertedData, error: insertError } = await supabase
      .from('renewal_contracts')
      .insert(contractsWithUser)
      .select();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error(`Failed to insert contracts: ${insertError.message}`);
    }

    console.log(`Successfully inserted ${insertedData?.length} contracts`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported: insertedData?.length || 0,
        message: `Successfully imported ${insertedData?.length || 0} contracts`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in import-renewal-list function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
