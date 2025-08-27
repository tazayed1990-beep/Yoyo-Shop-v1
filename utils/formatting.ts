export const formatCurrency = (value: number): string => {
  if (isNaN(value)) {
    value = 0;
  }
  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
  }).format(value);
};
