export const resolveCheckoutModeRule = ({ amountInr, providerPlanId }) => {
  const amount = Number(amountInr) || 0;
  if (amount <= 0) return 'zero_amount';
  if (String(providerPlanId || '').trim()) return 'razorpay_subscription';
  return 'razorpay_order';
};

