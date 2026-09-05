import { describe, it, expect } from 'vitest';
import { ms, kb, formatDate } from './utils';

describe('findings utils', () => {
  describe('ms', () => {
    it('returns "—" for null', () => {
      expect(ms(null)).toBe('—');
    });

    it('returns formatted string in ms for values < 1000', () => {
      expect(ms(0)).toBe('0ms');
      expect(ms(500)).toBe('500ms');
      expect(ms(999)).toBe('999ms');
      expect(ms(999.4)).toBe('999ms');
      expect(ms(999.5)).toBe('1000ms');
    });

    it('returns formatted string in s for values >= 1000', () => {
      expect(ms(1000)).toBe('1.00s');
      expect(ms(1500)).toBe('1.50s');
      expect(ms(1050)).toBe('1.05s');
      expect(ms(2000)).toBe('2.00s');
      expect(ms(1555.5)).toBe('1.56s');
    });
  });

  describe('kb', () => {
    it('returns formatted string in KB for values < 1_048_576', () => {
      expect(kb(0)).toBe('0 KB');
      expect(kb(1024)).toBe('1 KB');
      expect(kb(512)).toBe('1 KB'); // Math.round(512/1024) -> Math.round(0.5) -> 1
      expect(kb(511)).toBe('0 KB'); // Math.round(511/1024) -> Math.round(0.499) -> 0
      expect(kb(1_048_575)).toBe('1024 KB');
    });

    it('returns formatted string in MB for values >= 1_048_576', () => {
      expect(kb(1_048_576)).toBe('1.0 MB');
      expect(kb(1_572_864)).toBe('1.5 MB'); // 1.5 * 1024 * 1024
      expect(kb(2_097_152)).toBe('2.0 MB'); // 2 * 1024 * 1024
    });
  });

  describe('formatDate', () => {
    it('returns "—" for null', () => {
      expect(formatDate(null)).toBe('—');
    });

    it('returns formatted date in pt-BR format for valid ISO string', () => {
      // Create a date in UTC to avoid time zone issues in the test
      // Since toLocaleDateString uses the local timezone by default,
      // we need to be careful with exact date matching if we provide midnight UTC
      // For a date string '2023-10-15T12:00:00Z', the local date should be the 15th
      expect(formatDate('2023-10-15T12:00:00Z')).toBe('15/10/2023');

      // Let's test a simple date-only string.
      // Note: new Date('2023-01-01') in JS parses as UTC midnight.
      // In a western timezone (like BRT, UTC-3), this becomes Dec 31, 2022.
      // So testing with T12:00:00Z is safer for date extraction.
      expect(formatDate('2024-02-29T12:00:00Z')).toBe('29/02/2024');
    });
  });
});
