import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";

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

    const { fileData } = await req.json();

    if (!fileData) {
      throw new Error("No file data provided");
    }

    console.log("Processing Excel file...");

    // Decode base64 file data
    const base64Data = fileData.split(',')[1] || fileData;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Parse Excel file
    const workbook = XLSX.read(bytes, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length < 2) {
      throw new Error("Excel file has no data rows");
    }

    // Get headers from first row
    const headers = (jsonData[0] as string[]).map(h => 
      String(h || '').toLowerCase().trim()
    );

    console.log("Headers found:", headers);

    // Map column indices
    const columnMap: Record<string, number> = {};
    headers.forEach((header, index) => {
      if (header.includes('client')) columnMap.client = index;
      if (header.includes('start') && header.includes('date')) columnMap.startDate = index;
      if (header.includes('end') && header.includes('date')) columnMap.endDate = index;
      if (header.includes('value') || header.includes('vat')) columnMap.value = index;
      if (header.includes('billing')) columnMap.billing = index;
      if (header.includes('billed')) columnMap.billed = index;
      if (header.includes('service')) columnMap.service = index;
      if (header.includes('zone')) columnMap.zone = index;
      if (header.includes('contact') || header.includes('phone') || header.includes('number')) columnMap.contact = index;
      if (header.includes('email')) columnMap.email = index;
    });

    console.log("Column mapping:", columnMap);

    // Parse date helper
    const parseDate = (value: any): string | null => {
      if (!value) return null;
      
      // If it's a number (Excel serial date)
      if (typeof value === 'number') {
        const date = XLSX.SSF.parse_date_code(value);
        if (date) {
          return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
        }
      }
      
      // If it's a string, try to parse it
      const dateStr = String(value);
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
      
      return null;
    };

    // Parse data rows
    const contracts: any[] = [];
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];
      if (!row || row.length === 0) continue;

      const client = row[columnMap.client];
      if (!client) continue; // Skip rows without client name

      contracts.push({
        user_id: userId,
        client: String(client).trim(),
        contract_start_date: parseDate(row[columnMap.startDate]),
        contract_end_date: parseDate(row[columnMap.endDate]),
        value_of_contract_vat: parseFloat(row[columnMap.value]) || 0,
        type_of_billing: row[columnMap.billing] ? String(row[columnMap.billing]).trim() : null,
        billed: row[columnMap.billed] === true || String(row[columnMap.billed]).toLowerCase() === 'yes',
        type_of_service: row[columnMap.service] ? String(row[columnMap.service]).trim() : null,
        zone: row[columnMap.zone] ? String(row[columnMap.zone]).trim() : null,
        contact_number: row[columnMap.contact] ? String(row[columnMap.contact]).trim() : null,
        email: row[columnMap.email] ? String(row[columnMap.email]).trim() : null,
        renewal_status: 'pending'
      });
    }

    console.log(`Parsed ${contracts.length} contracts`);

    if (contracts.length === 0) {
      throw new Error("No valid contracts found in file");
    }

    // Insert contracts into database
    const { data: insertedData, error: insertError } = await supabase
      .from('renewal_contracts')
      .insert(contracts)
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
