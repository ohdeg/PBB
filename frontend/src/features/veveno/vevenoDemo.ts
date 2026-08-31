export const VEVENO_DEMO_STORE_ID = 'demo';
export const VEVENO_DEMO_OWNER_ID = 'demo-owner';
export const VEVENO_DEMO_STAFF_ID = 'demo-staff';

export type VevenoDemoRole = 'owner' | 'staff';

export function isVevenoDemoStoreId(storeId: string): boolean {
  return storeId === VEVENO_DEMO_STORE_ID;
}

export function isVevenoDemoRequest(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const path = window.location.pathname;
  return (
    path.includes(`/hobbies/veveno/stores/${VEVENO_DEMO_STORE_ID}`)
    || path.includes(`/hobbies/veveno/pos/store/${VEVENO_DEMO_STORE_ID}`)
  );
}
