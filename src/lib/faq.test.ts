import { describe, it, expect } from 'vitest';
import { FAQ_ITEMS } from './faq';

describe('FAQ_ITEMS', () => {
  it('should not be empty', () => {
    expect(FAQ_ITEMS.length).toBeGreaterThan(0);
  });

  it('should have valid "q" (question) and "a" (answer) properties for each item', () => {
    for (const item of FAQ_ITEMS) {
      expect(typeof item.q).toBe('string');
      expect(item.q.trim().length).toBeGreaterThan(0);

      expect(Array.isArray(item.a)).toBe(true);
      expect(item.a.length).toBeGreaterThan(0);

      for (const paragraph of item.a) {
        expect(typeof paragraph).toBe('string');
        expect(paragraph.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
