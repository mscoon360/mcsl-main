import { useMemo } from 'react';
import { useSales } from './useSales';
import { useCustomers } from './useCustomers';
import { differenceInDays } from 'date-fns';

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
  zone: string | null;
  phone: string | null;
  email: string | null;
}

export function useRenewalList() {
  const { sales } = useSales();
  const { customers } = useCustomers();

  // Create a lookup map for customers by company name
  const customerLookup = useMemo(() => {
    const lookup = new Map<string, { zone: string | null; phone: string | null; email: string | null }>();
    customers.forEach(customer => {
      const key = customer.company?.toLowerCase() || customer.name?.toLowerCase() || '';
      if (key) {
        lookup.set(key, {
          zone: customer.zone || null,
          phone: customer.phone || null,
          email: customer.email || null
        });
      }
    });
    return lookup;
  }, [customers]);

  const renewalList = useMemo(() => {
    const now = new Date();
    const contracts: RenewalContract[] = [];

    sales.forEach(sale => {
      // Look up customer info
      const customerKey = sale.customer_name?.toLowerCase() || '';
      const customerInfo = customerLookup.get(customerKey) || { zone: null, phone: null, email: null };

      sale.items
        .filter(item => item.is_rental && item.start_date && item.end_date)
        .forEach(item => {
          const startDate = new Date(item.start_date!);
          const endDate = new Date(item.end_date!);
          const daysUntilExpiry = differenceInDays(endDate, now);
          const daysSinceExpiry = differenceInDays(now, endDate);

          // Include contracts that:
          // 1. Are expiring within the next 60 days (active, expiring soon)
          // 2. Have expired within the last 30 days (recently expired, need follow-up)
          const isExpiringSoon = daysUntilExpiry > 0 && daysUntilExpiry <= 60;
          const isRecentlyExpired = daysSinceExpiry > 0 && daysSinceExpiry <= 30;

          if (isExpiringSoon || isRecentlyExpired) {
            // item.price is the payment amount for the period
            const paymentPeriod = item.payment_period?.toLowerCase() || 'monthly';
            const paymentAmount = item.price * item.quantity;
            
            // Convert payment amount to yearly value based on billing frequency
            let yearlyValue: number;
            switch (paymentPeriod) {
              case 'weekly': yearlyValue = paymentAmount * 52; break;
              case 'bi-weekly': yearlyValue = paymentAmount * 26; break;
              case 'bi-monthly': yearlyValue = paymentAmount * 6; break;
              case 'monthly': yearlyValue = paymentAmount * 12; break;
              case 'quarterly': yearlyValue = paymentAmount * 4; break;
              case 'biannually':
              case 'bi-annually': yearlyValue = paymentAmount * 2; break;
              case 'annually':
              case 'yearly': yearlyValue = paymentAmount; break;
              default: yearlyValue = paymentAmount * 12; break;
            }

            const monthlyAmount = yearlyValue / 12;
            
            contracts.push({
              id: `${sale.id}-${item.product_name}`,
              customer: sale.customer_name,
              product: item.product_name,
              contractLength: item.contract_length || '',
              paymentPeriod: item.payment_period || 'monthly',
              startDate,
              endDate,
              monthlyAmount,
              totalValue: yearlyValue,
              status: isExpiringSoon ? 'expiring-soon' : 'recently-expired',
              daysUntilExpiry: isExpiringSoon ? daysUntilExpiry : 0,
              daysSinceExpiry: isRecentlyExpired ? daysSinceExpiry : 0,
              saleId: sale.id,
              renewalStatus: null,
              zone: customerInfo.zone,
              phone: customerInfo.phone,
              email: customerInfo.email
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
  }, [sales, customerLookup]);

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
