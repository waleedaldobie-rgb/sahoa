import { AccessoryItem, AppData, FabricItem } from '../../types';

export function createFabricInDraft(draft: AppData, fabric: Partial<FabricItem>): FabricItem {
  const newFabric: FabricItem = {
    id: fabric.id || `FAB-${Date.now()}`,
    name: fabric.name || '',
    color: fabric.color || '',
    colorHex: fabric.colorHex || '#ffffff',
    purchasePrice: fabric.purchasePrice || 0,
    sellingPrice: fabric.sellingPrice || 0,
    quantityMeters: fabric.quantityMeters || 0,
    minStockMeters: fabric.minStockMeters || 0
  };
  draft.fabrics = [newFabric, ...draft.fabrics];
  return newFabric;
}

export function updateFabricInDraft(draft: AppData, fabric: FabricItem): boolean {
  draft.fabrics = draft.fabrics.map((item) => item.id === fabric.id ? fabric : item);
  return true;
}

export function createAccessoryInDraft(draft: AppData, accessory: Partial<AccessoryItem>): AccessoryItem {
  const newAccessory: AccessoryItem = {
    id: accessory.id || `ACC-${Date.now()}`,
    name: accessory.name || '',
    category: accessory.category || '',
    quantity: accessory.quantity || 0,
    minStock: accessory.minStock || 0,
    unit: accessory.unit || 'حبة'
  };
  draft.accessories = [newAccessory, ...draft.accessories];
  return newAccessory;
}

export function updateAccessoryInDraft(draft: AppData, accessory: AccessoryItem): boolean {
  draft.accessories = draft.accessories.map((item) => item.id === accessory.id ? accessory : item);
  return true;
}
