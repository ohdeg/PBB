import { describe, expect, it } from 'vitest';
import { getNavHobbies } from './hobbies';

describe('getNavHobbies', () => {
  it('hides 6PICK and Dieta unless DEV', () => {
    const publicIds = getNavHobbies(false).map((app) => app.id);
    expect(publicIds).not.toContain('6pick');
    expect(publicIds).not.toContain('dieta');
    expect(publicIds).toContain('veveno');

    const devIds = getNavHobbies(true).map((app) => app.id);
    expect(devIds).toContain('6pick');
    expect(devIds).toContain('dieta');
  });
});
