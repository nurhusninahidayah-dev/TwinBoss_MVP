export interface BoutiqueOrder {
  orderId: string;
  customerName: string;
  itemName: string;
  price: number;
  isRefunded: boolean;
  customerTier: 'VIP' | 'Regular';
}

export const boutiqueName = 'Verdant & Vogue Boutique';

export const autoPilotAmountLimit = 100;
export const autoPilotValidityThreshold = 70;

export const refundBusinessRule =
  'Reject if staff validity is below 70%, staff risk is not Low, or the customer says they changed their mind. Otherwise, approve cash for VIP customers. Otherwise, offer store credit to Regular customers when the order price is over RM50. For cases not covered by these rules, choose the most appropriate decision based on the evidence.';

export const orders: BoutiqueOrder[] = [
  {
    orderId: 'ORD-101',
    customerName: 'Siti',
    itemName: 'Emerald Silk Dress',
    price: 150,
    isRefunded: false,
    customerTier: 'VIP',
  },
  {
    orderId: 'ORD-102',
    customerName: 'Ali',
    itemName: 'Linen Casual Shirt',
    price: 80,
    isRefunded: false,
    customerTier: 'Regular',
  },
  {
    orderId: 'ORD-103',
    customerName: 'Kumar',
    itemName: 'Wool Winter Coat',
    price: 250,
    isRefunded: true,
    customerTier: 'Regular',
  },
  {
    orderId: 'ORD-104',
    customerName: 'Mei Ling',
    itemName: 'Floral Summer Blouse',
    price: 120,
    isRefunded: false,
    customerTier: 'Regular',
  },
  {
    orderId: 'ORD-105',
    customerName: 'Raj',
    itemName: 'Leather Belt',
    price: 60,
    isRefunded: false,
    customerTier: 'Regular',
  },
  {
    orderId: 'ORD-106',
    customerName: 'Sarah',
    itemName: 'Cashmere Scarf',
    price: 95,
    isRefunded: true,
    customerTier: 'Regular',
  },
];
