import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackfillRequest {
  batch_size?: number;
  test_mode?: boolean;
  source_types?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { batch_size = 50, test_mode = false, source_types = ['sale', 'payment', 'expense'] } = 
      await req.json() as BackfillRequest;

    const batch_id = crypto.randomUUID();
    const results = {
      batch_id,
      processed: 0,
      success: 0,
      error: 0,
      skipped: 0,
      details: [] as any[]
    };

    console.log(`Starting backfill batch ${batch_id}, test_mode: ${test_mode}`);

    // Backfill sales
    if (source_types.includes('sale')) {
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .eq('status', 'completed')
        .order('date', { ascending: false })
        .limit(batch_size);

      if (salesError) throw salesError;

      for (const sale of sales || []) {
        results.processed++;
        
        try {
          // Check if entry already exists
          const { data: existing } = await supabase
            .from('ledger_entries')
            .select('id')
            .eq('transaction_id', sale.id)
            .eq('source_type', 'sale')
            .single();

          if (existing) {
            results.skipped++;
            await supabase.from('ledger_backfill_logs').insert({
              batch_id,
              source_type: 'sale',
              source_id: sale.id,
              status: 'skipped',
              error_message: 'Entry already exists'
            });
            continue;
          }

          // Create ledger entry
          const entries = [
            {
              account_code: '1100_accounts_receivable',
              debit: sale.total,
              credit: 0,
              currency: 'USD',
              memo: `Sale to ${sale.customer_name}`,
              meta: { sale_id: sale.id }
            },
            {
              account_code: '4000_sales_revenue',
              debit: 0,
              credit: sale.total,
              currency: 'USD',
              memo: `Revenue from sale ${sale.id}`,
              meta: { sale_id: sale.id }
            }
          ];

          if (!test_mode) {
            const { error: insertError } = await supabase
              .from('ledger_entries')
              .insert({
                source_type: 'sale',
                source_id: sale.id,
                transaction_id: sale.id,
                entries: entries,
                total_debit: sale.total,
                total_credit: sale.total,
                user_id: sale.user_id,
                status: 'posted',
                balance_hash: '' // Will be computed by trigger
              });

            if (insertError) throw insertError;
          }

          results.success++;
          await supabase.from('ledger_backfill_logs').insert({
            batch_id,
            source_type: 'sale',
            source_id: sale.id,
            status: 'success'
          });

          results.details.push({ type: 'sale', id: sale.id, status: 'success' });
        } catch (error: any) {
          results.error++;
          await supabase.from('ledger_backfill_logs').insert({
            batch_id,
            source_type: 'sale',
            source_id: sale.id,
            status: 'error',
            error_message: error.message
          });
          console.error(`Error processing sale ${sale.id}:`, error);
          results.details.push({ type: 'sale', id: sale.id, status: 'error', error: error.message });
        }
      }
    }

    // Backfill payments
    if (source_types.includes('payment')) {
      const { data: payments, error: paymentsError } = await supabase
        .from('payment_schedules')
        .select('*')
        .eq('status', 'paid')
        .order('paid_date', { ascending: false })
        .limit(batch_size);

      if (paymentsError) throw paymentsError;

      for (const payment of payments || []) {
        results.processed++;
        
        try {
          const { data: existing } = await supabase
            .from('ledger_entries')
            .select('id')
            .eq('transaction_id', payment.id)
            .eq('source_type', 'payment')
            .single();

          if (existing) {
            results.skipped++;
            await supabase.from('ledger_backfill_logs').insert({
              batch_id,
              source_type: 'payment',
              source_id: payment.id,
              status: 'skipped',
              error_message: 'Entry already exists'
            });
            continue;
          }

          const entries = [
            {
              account_code: '1000_cash_bank',
              debit: payment.amount,
              credit: 0,
              currency: 'USD',
              memo: `Payment received from ${payment.customer}`,
              meta: { payment_id: payment.id, method: payment.payment_method }
            },
            {
              account_code: '1100_accounts_receivable',
              debit: 0,
              credit: payment.amount,
              currency: 'USD',
              memo: `Payment for ${payment.product}`,
              meta: { payment_id: payment.id }
            }
          ];

          if (!test_mode) {
            const { error: insertError } = await supabase
              .from('ledger_entries')
              .insert({
                source_type: 'payment',
                source_id: payment.id,
                transaction_id: payment.id,
                entries: entries,
                total_debit: payment.amount,
                total_credit: payment.amount,
                user_id: payment.user_id,
                status: 'posted',
                balance_hash: ''
              });

            if (insertError) throw insertError;
          }

          results.success++;
          await supabase.from('ledger_backfill_logs').insert({
            batch_id,
            source_type: 'payment',
            source_id: payment.id,
            status: 'success'
          });

          results.details.push({ type: 'payment', id: payment.id, status: 'success' });
        } catch (error: any) {
          results.error++;
          await supabase.from('ledger_backfill_logs').insert({
            batch_id,
            source_type: 'payment',
            source_id: payment.id,
            status: 'error',
            error_message: error.message
          });
          console.error(`Error processing payment ${payment.id}:`, error);
          results.details.push({ type: 'payment', id: payment.id, status: 'error', error: error.message });
        }
      }
    }

    // Backfill expenses
    if (source_types.includes('expense')) {
      const { data: expenses, error: expensesError } = await supabase
        .from('expenditures')
        .select('*')
        .order('date', { ascending: false })
        .limit(batch_size);

      if (expensesError) throw expensesError;

      for (const expense of expenses || []) {
        results.processed++;
        
        try {
          const { data: existing } = await supabase
            .from('ledger_entries')
            .select('id')
            .eq('transaction_id', expense.id)
            .eq('source_type', 'expense')
            .single();

          if (existing) {
            results.skipped++;
            await supabase.from('ledger_backfill_logs').insert({
              batch_id,
              source_type: 'expense',
              source_id: expense.id,
              status: 'skipped',
              error_message: 'Entry already exists'
            });
            continue;
          }

          const expense_account = expense.category === 'working-capital' 
            ? '5100_operating_expenses' 
            : expense.category === 'fixed-capital'
            ? '5200_capital_expenses'
            : '5000_general_expenses';

          const entries = [
            {
              account_code: expense_account,
              debit: expense.amount,
              credit: 0,
              currency: 'USD',
              memo: expense.description,
              meta: { expense_id: expense.id, type: expense.type }
            },
            {
              account_code: '1000_cash_bank',
              debit: 0,
              credit: expense.amount,
              currency: 'USD',
              memo: `Payment for ${expense.description}`,
              meta: { expense_id: expense.id }
            }
          ];

          if (!test_mode) {
            const { error: insertError } = await supabase
              .from('ledger_entries')
              .insert({
                source_type: 'expense',
                source_id: expense.id,
                transaction_id: expense.id,
                entries: entries,
                total_debit: expense.amount,
                total_credit: expense.amount,
                user_id: expense.user_id,
                status: 'posted',
                balance_hash: ''
              });

            if (insertError) throw insertError;
          }

          results.success++;
          await supabase.from('ledger_backfill_logs').insert({
            batch_id,
            source_type: 'expense',
            source_id: expense.id,
            status: 'success'
          });

          results.details.push({ type: 'expense', id: expense.id, status: 'success' });
        } catch (error: any) {
          results.error++;
          await supabase.from('ledger_backfill_logs').insert({
            batch_id,
            source_type: 'expense',
            source_id: expense.id,
            status: 'error',
            error_message: error.message
          });
          console.error(`Error processing expense ${expense.id}:`, error);
          results.details.push({ type: 'expense', id: expense.id, status: 'error', error: error.message });
        }
      }
    }

    console.log(`Backfill complete:`, results);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
