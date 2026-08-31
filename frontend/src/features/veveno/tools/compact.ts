import { isVevenoPosKioskPath } from '../pos/session';

const POP_NAME = 'veveno-tools';
const POP_FEATURES = 'popup=yes,width=380,height=640';

export function isVevenoToolsPopPath(pathname: string): boolean {
  return (
    /^\/hobbies\/veveno\/stores\/[^/]+\/tools$/.test(pathname)
    || /^\/hobbies\/veveno\/pos\/store\/[^/]+\/tools$/.test(pathname)
  );
}

export function vevenoToolsPopUrl(storeId: string, pathname: string): string {
  return isVevenoPosKioskPath(pathname)
    ? `/hobbies/veveno/pos/store/${storeId}/tools`
    : `/hobbies/veveno/stores/${storeId}/tools`;
}

export function openVevenoToolsPopup(storeId: string, pathname: string): Window | null {
  return window.open(vevenoToolsPopUrl(storeId, pathname), POP_NAME, POP_FEATURES);
}
