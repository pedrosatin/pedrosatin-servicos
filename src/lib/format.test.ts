import { describe, it, expect } from 'vitest';
import {
  formatMs,
  formatDate,
  formatScore,
} from './format';

describe('formatMs', () => {
  it('returns "—" for null or undefined', () => {
    expect(formatMs(null)).toBe('—');
    expect(formatMs(undefined)).toBe('—');
  });

  it('formats small ms values in ms', () => {
    expect(formatMs(0)).toBe('0 ms');
    expect(formatMs(50)).toBe('50 ms');
    expect(formatMs(999)).toBe('999 ms');
    expect(formatMs(12.34)).toBe('12 ms'); // Math.round
  });

  it('formats large values in seconds', () => {
    expect(formatMs(1000)).toBe('1.00 s');
    expect(formatMs(1500)).toBe('1.50 s');
    expect(formatMs(2045)).toBe('2.04 s'); // (value / 1000).toFixed(2) -> 2.04 s
    expect(formatMs(2046)).toBe('2.05 s');
  });
});

describe('formatDate', () => {
  it('returns "—" for null or undefined', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
  });

  it('formats ISO strings to pt-BR locale', () => {
    const dateStr = '2023-10-05T14:30:00Z';
    // The exact string depends on the runtime timezone, we can use regex or mock to be safe, but pt-BR typically yields DD/MM/YYYY.
    // Given JSDOM, it usually defaults to UTC if no TZ is set, let's just check standard formatting.
    // 2023-10-05
    const formatted = formatDate(dateStr);
    expect(formatted).toMatch(/05\/10\/2023/);
  });
});

describe('formatScore', () => {
  it('returns "—" for null or undefined', () => {
    expect(formatScore(null)).toBe('—');
    expect(formatScore(undefined)).toBe('—');
  });

  it('formats numeric scores as strings', () => {
    expect(formatScore(0)).toBe('0');
    expect(formatScore(55)).toBe('55');
    expect(formatScore(100)).toBe('100');
  });
});


