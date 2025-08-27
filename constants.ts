import { ProductionStatus, ShippingStatus, UserRole, UnitType } from './types';

export const PRODUCTION_STATUSES: ProductionStatus[] = ["Not Started", "Started", "Layer 1", "Layer 2", "Final Layer", "Finished"];
export const SHIPPING_STATUSES: ShippingStatus[] = ["Ready", "Out for Shipment", "Out for Delivery", "Delivered"];
export const USER_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.STAFF, UserRole.VIEWER];
export const UNIT_TYPES: UnitType[] = ['weight', 'piece'];
export const UNIT_LABELS = {
    weight: ['g', 'kg'],
    piece: ['piece']
};
export const EXPENSE_CATEGORIES: string[] = ['Rent', 'Salaries', 'Utilities', 'Supplies', 'Marketing', 'Transportation', 'Other'];