export const customer = {
  name: 'Siti',
  tier: 'VIP',
  lifetimeValue: 5000,
  initials: 'S',
  source: 'Orbyte CRM preview',
};

export const customers = [customer] as const;

export const businessRule = {
  title: 'VIP refund exception',
  description: 'Auto-approve VIP refunds under RM200',
  amountLimit: 200,
};
