import { useMemo } from 'react';
import { useSales } from './useSales';
import { differenceInDays, differenceInMonths } from 'date-fns';

export interface RenewalContract {
  id: string;
  customer: string;
  product: string;
  contractLength: string;
  paymentPeriod: string;
  startDate: Date;
  endDate: Date;
  monthlyAmount: number;
  totalValue: number;
  status: 'expiring-soon' | 'recently-expired';
  daysUntilExpiry: number;
  daysSinceExpiry: number;
  saleId: string;
  renewalStatus: 'pending' | 'approved' | 'declined' | null;
}

export function useRenewalList() {
  const { sales } = useSales();

  const renewalList = useMemo(() => {
    const now = new Date();
    const contracts: RenewalContract[] = [];

    sales.forEach(sale => {
      sale.items
        .filter(item => item.is_rental && item.start_date && item.end_date)
        .forEach(item => {
          const startDate = new Date(item.start_date!);
          const endDate = new Date(item.end_date!);
          const daysUntilExpiry = differenceInDays(endDate, now);
          const daysSinceExpiry = differenceInDays(now, endDate);
          const monthsInContract = differenceInMonths(endDate, startDate);

          // Include contracts that:
          // 1. Are expiring within the next 60 days (active, expiring soon)
          // 2. Have expired within the last 30 days (recently expired, need follow-up)
          const isExpiringSoon = daysUntilExpiry > 0 && daysUntilExpiry <= 60;
          const isRecentlyExpired = daysSinceExpiry > 0 && daysSinceExpiry <= 30;

          if (isExpiringSoon || isRecentlyExpired) {
            contracts.push({
              id: `${sale.id}-${item.product_name}`,
              customer: sale.customer_name,
              product: item.product_name,
              contractLength: item.contract_length || '',
              paymentPeriod: item.payment_period || 'monthly',
              startDate,
              endDate,
              monthlyAmount: item.price * item.quantity,
              totalValue: item.price * monthsInContract * item.quantity,
              status: isExpiringSoon ? 'expiring-soon' : 'recently-expired',
              daysUntilExpiry: isExpiringSoon ? daysUntilExpiry : 0,
              daysSinceExpiry: isRecentlyExpired ? daysSinceExpiry : 0,
              saleId: sale.id,
              renewalStatus: null // Can be extended to track renewal status
            });
          }
        });
    });

    // Sort by urgency: recently expired first, then by days until expiry
    return contracts.sort((a, b) => {
      // Recently expired contracts come first
      if (a.status === 'recently-expired' && b.status !== 'recently-expired') return -1;
      if (a.status !== 'recently-expired' && b.status === 'recently-expired') return 1;
      
      // Within same status, sort by urgency
      if (a.status === 'recently-expired' && b.status === 'recently-expired') {
        return b.daysSinceExpiry - a.daysSinceExpiry; // More days since expiry = more urgent
      }
      return a.daysUntilExpiry - b.daysUntilExpiry; // Fewer days until expiry = more urgent
    });
  }, [sales]);

  const stats = useMemo(() => ({
    total: renewalList.length,
    expiringSoon: renewalList.filter(c => c.status === 'expiring-soon').length,
    recentlyExpired: renewalList.filter(c => c.status === 'recently-expired').length,
    totalMonthlyValue: renewalList.reduce((sum, c) => sum + c.monthlyAmount, 0)
  }), [renewalList]);

  return {
    renewalList,
    stats
  };
}
