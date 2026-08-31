import { describe, expect, it } from 'vitest';
import { isVevenoToolsPopPath, vevenoToolsPopUrl } from './compact';

describe('veveno tools compact paths', () => {
  it('recognizes store and POS tools pop routes', () => {
    expect(isVevenoToolsPopPath('/hobbies/veveno/stores/demo/tools')).toBe(true);
    expect(isVevenoToolsPopPath('/hobbies/veveno/pos/store/abc/tools')).toBe(true);
    expect(isVevenoToolsPopPath('/hobbies/veveno/stores/demo')).toBe(false);
    expect(isVevenoToolsPopPath('/hobbies/veveno/pos/store/abc')).toBe(false);
  });

  it('builds the matching pop url', () => {
    expect(vevenoToolsPopUrl('demo', '/hobbies/veveno/stores/demo')).toBe(
      '/hobbies/veveno/stores/demo/tools',
    );
    expect(vevenoToolsPopUrl('abc', '/hobbies/veveno/pos/store/abc')).toBe(
      '/hobbies/veveno/pos/store/abc/tools',
    );
  });
});
