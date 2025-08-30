// User and Auth Types
export enum UserRole {
  ADMIN = 'admin',
  STAFF = 'staff',
  VIEWER = 'viewer',
}

export interface User {
  uid: string;
  email: string | null;
  name?: string;
  role: UserRole;
  createdAt?: any;
  referralCode?: string;
  referredById?: string;
}

// Customer Types
export interface Customer {
  id: string;
  fullName: string;
  address: string;
  phoneNumber: string;
  email?: string;
  createdAt: any;
  // Added for reporting
  orderCount?: number;
  totalSpent?: number;
  // Added for sales tracking
  referredById?: string;
  referredByName?: string;
}

// Material and Product Types
export type UnitType = 'weight' | 'piece';

export interface Material {
  id: string;
  name: string;
  unitType: UnitType;
  unitLabel: 'g' | 'kg' | 'piece';
  pricePerUnit: number;
  stockQty: number;
  minQty?: number;
}

export interface ProductMaterial {
  materialId: string;
  name: string; // denormalized for display
  quantity: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number; // Final selling price
  materials: ProductMaterial[];
  materialsCost: number; // Computed cost from materials
}

// Order and Invoice Types
export type ProductionStatus = "Not Started" | "Started" | "Layer 1" | "Layer 2" | "Final Layer" | "Finished";
export type ShippingStatus = "Ready" | "Out for Shipment" | "Out for Delivery" | "Delivered";

export interface OrderItem {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  materialsCost: number; // Cost per unit at time of order
  lineTotal: number;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string; // denormalized for display
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  depositPaid: boolean;
  depositAmount: number;
  productionStatus: ProductionStatus;
  shippingStatus: ShippingStatus;
  notes?: string;
  isCancelled: boolean;
  stockDeducted?: boolean;
  createdAt: any;
  updatedAt: any;
  salespersonId?: string;
  salespersonName?: string;
}

export interface Invoice {
    id: string;
    orderId: string;
    customer: Customer;
    order: Order;
    settings: Settings;
    issueDate: Date;
}

// Settings Types
export interface Settings {
    companyName: string;
    companyAddress: string;
    companyPhone: string;
    commissionRate?: number;
}

export type Language = 'en' | 'ar';

// Expense Types
export interface Expense {
  id: string;
  name: string;
  category: string;
  amount: number;
  date: any; // Firestore Timestamp
}

// Dashboard Types
export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  totalDeposits: number;
  depositOrdersCount: number;
  totalCustomers: number;
  totalMaterialCost: number;
  totalExpenses: number;
  netProfit: number;
}

// Reward System Types
export type RewardType = 'customerCount' | 'salesVolume';

export interface Reward {
  id: string;
  name: string;
  type: RewardType;
  target: number; // e.g., 10 customers or 50000 in sales
  rewardAmount: number;
  timeframeDays: number; // e.g., 30 for a monthly goal
  isActive: boolean;
}

export interface EarnedReward {
  id: string;
  rewardId: string;
  rewardName: string;
  salespersonId: string;
  salespersonName: string;
  dateEarned: any; // Firestore Timestamp
  amount: number;
}
