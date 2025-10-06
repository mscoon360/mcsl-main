// Utility to clear all localStorage data
export const clearAllLocalStorageData = () => {
  const keysToRemove = [
    'dashboard-customers',
    'dashboard-products',
    'dashboard-sales',
    'invoices',
    'finance-expenditures',
    'dashboard-fulfillment',
    'dashboard-payment-schedules',
    'paid-rental-payments'
  ];
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
  
  console.log('All local storage data has been cleared');
};

// Run this automatically on app load to clear old data
if (typeof window !== 'undefined') {
  clearAllLocalStorageData();
}
