import { useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { differenceInDays, differenceInMonths } from 'date-fns';

interface ExpiringContract {
  id: string;
  customer: string;
  product: string;
  endDate: Date;
  daysUntilExpiry: number;
  monthlyAmount: number;
}

export function useExpiringContracts() {
  const [sales] = useLocalStorage<Array<{
    id: string;
    customer: string;
    total: number;
    items: Array<{
      product: string;
      quantity: number;
      price: number;
      isRental?: boolean;
      contractLength?: string;
      paymentPeriod?: string;
      startDate?: Date;
      endDate?: Date;
    }>;
    date: string;
    status: string;
  }>>('dashboard-sales', []);

  const expiringContracts = useMemo(() => {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const contracts: ExpiringContract[] = [];

    sales.forEach(sale => {
      sale.items
        .filter(item => item.isRental && item.startDate && item.endDate)
        .forEach(item => {
          const endDate = new Date(item.endDate!);
          const daysUntilExpiry = differenceInDays(endDate, now);

          // Only include active contracts expiring within 30 days
          if (daysUntilExpiry > 0 && daysUntilExpiry <= 30) {
            contracts.push({
              id: `${sale.id}-${item.product}`,
              customer: sale.customer,
              product: item.product,
              endDate,
              daysUntilExpiry,
              monthlyAmount: item.price
            });
          }
        });
    });

    return contracts;
  }, [sales]);

  return {
    expiringContracts,
    count: expiringContracts.length
  };
}
