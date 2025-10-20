import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface LedgerEntry {
  id: string;
  source_type: 'sale' | 'payment' | 'expense' | 'refund' | 'invoice_adjustment' | 'accounts_payable' | 'accounts_receivable';
  source_id: string;
  transaction_id: string;
  entries: Array<{
    account_code: string;
    debit: number;
    credit: number;
    currency: string;
    memo: string;
    meta?: any;
  }>;
  total_debit: number;
  total_credit: number;
  posted_at: string;
  status: 'posted' | 'reversed' | 'pending';
  balance_hash: string;
  meta?: any;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface TrialBalanceSummary {
  account_code: string;
  total_debit: number;
  total_credit: number;
  balance: number;
}

export const useLedgerEntries = () => {
  const { toast } = useToast();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceSummary[]>([]);
  const [isBalanced, setIsBalanced] = useState(true);

  const fetchEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('ledger_entries')
        .select('*')
        .order('posted_at', { ascending: false });

      if (error) throw error;
      const ledgerData = (data || []).map(entry => ({
        ...entry,
        source_type: entry.source_type as LedgerEntry['source_type'],
        status: entry.status as LedgerEntry['status']
      })) as LedgerEntry[];
      setEntries(ledgerData);
      
      // Calculate trial balance
      calculateTrialBalance(ledgerData);
    } catch (error: any) {
      console.error('Error fetching ledger entries:', error);
      toast({
        title: 'Error loading ledger entries',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateTrialBalance = (ledgerData: LedgerEntry[]) => {
    const accountBalances = new Map<string, { debit: number; credit: number }>();
    
    // Only include posted entries
    const postedEntries = ledgerData.filter(entry => entry.status === 'posted');
    
    postedEntries.forEach(entry => {
      entry.entries.forEach((line: any) => {
        const account = line.account_code;
        const existing = accountBalances.get(account) || { debit: 0, credit: 0 };
        
        accountBalances.set(account, {
          debit: existing.debit + (line.debit || 0),
          credit: existing.credit + (line.credit || 0)
        });
      });
    });

    const summary: TrialBalanceSummary[] = Array.from(accountBalances.entries()).map(
      ([account_code, balances]) => ({
        account_code,
        total_debit: balances.debit,
        total_credit: balances.credit,
        balance: balances.debit - balances.credit
      })
    );

    setTrialBalance(summary);

    // Check if total debits equal total credits
    const totalDebits = summary.reduce((sum, acc) => sum + acc.total_debit, 0);
    const totalCredits = summary.reduce((sum, acc) => sum + acc.total_credit, 0);
    setIsBalanced(Math.abs(totalDebits - totalCredits) < 0.01); // Allow for rounding errors
  };

  const getUnbalancedEntries = () => {
    return entries.filter(entry => 
      entry.status === 'posted' && Math.abs(entry.total_debit - entry.total_credit) > 0.01
    );
  };

  const reverseEntry = async (entryId: string, reason: string) => {
    try {
      const entryToReverse = entries.find(e => e.id === entryId);
      if (!entryToReverse) throw new Error('Entry not found');

      // Create reversing entries (swap debits and credits)
      const reversingEntries = entryToReverse.entries.map((line: any) => ({
        ...line,
        debit: line.credit,
        credit: line.debit,
        memo: `REVERSAL: ${line.memo}`
      }));

      // Mark original as reversed
      const { error: updateError } = await supabase
        .from('ledger_entries')
        .update({ 
          status: 'reversed',
          meta: { ...entryToReverse.meta, reversed_at: new Date().toISOString(), reason }
        })
        .eq('id', entryId);

      if (updateError) throw updateError;

      // Create reversing entry
      const { error: insertError } = await supabase
        .from('ledger_entries')
        .insert({
          source_type: entryToReverse.source_type,
          source_id: entryToReverse.source_id,
          transaction_id: `${entryToReverse.transaction_id}_reversal`,
          entries: reversingEntries,
          total_debit: entryToReverse.total_credit,
          total_credit: entryToReverse.total_debit,
          status: 'posted',
          meta: { original_entry_id: entryId, reason, is_reversal: true },
          user_id: entryToReverse.user_id,
          balance_hash: '' // Will be computed by trigger
        });

      if (insertError) throw insertError;

      toast({ title: 'Entry reversed', description: 'Reversing entry has been posted.' });
      await fetchEntries();
    } catch (error: any) {
      console.error('Error reversing entry:', error);
      toast({ 
        title: 'Error reversing entry', 
        description: error.message, 
        variant: 'destructive' 
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchEntries();

    const channel = supabase
      .channel('ledger-entries-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ledger_entries' },
        () => fetchEntries()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { 
    entries, 
    loading, 
    trialBalance, 
    isBalanced,
    unbalancedEntries: getUnbalancedEntries(),
    reverseEntry,
    refetch: fetchEntries 
  };
};
