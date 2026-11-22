import { describe, it, expect } from 'vitest';
import {
  formatMs,
  formatBytes,
  formatDate,
} from './format';

describe('formatMs', () => {
  it('returns "—" for null or undefined', () => {
    expect(formatMs(null)).toBe('—');
    expect(formatMs(undefined)).toBe('—');
  });

  it('formats small ms values in ms', () => {
    expect(formatMs(0)).toBe('0 ms');
    expect(formatMs(50)).toBe('50 ms');
    expect(formatMs(500)).toBe('500 ms');
    expect(formatMs(999)).toBe('999 ms');
    expect(formatMs(12.34)).toBe('12 ms');
    expect(formatMs(999.4)).toBe('999 ms');
    expect(formatMs(999.5)).toBe('1000 ms');
  });

  it('formats large values in seconds', () => {
    expect(formatMs(1000)).toBe('1.00 s');
    expect(formatMs(1050)).toBe('1.05 s');
    expect(formatMs(1500)).toBe('1.50 s');
    expect(formatMs(1555.5)).toBe('1.56 s');
    expect(formatMs(2000)).toBe('2.00 s');
    expect(formatMs(2045)).toBe('2.04 s');
    expect(formatMs(2046)).toBe('2.05 s');
  });
});

describe('formatBytes', () => {
  it('returns "—" for null or undefined', () => {
    expect(formatBytes(null)).toBe('—');
    expect(formatBytes(undefined)).toBe('—');
  });

  it('formats values under 1 MiB as KB', () => {
    expect(formatBytes(0)).toBe('0 KB');
    expect(formatBytes(511)).toBe('0 KB');
    expect(formatBytes(512)).toBe('1 KB');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(1_048_575)).toBe('1024 KB');
  });

  it('formats values >= 1 MiB as MB', () => {
    expect(formatBytes(1_048_576)).toBe('1.0 MB');
    expect(formatBytes(1_572_864)).toBe('1.5 MB');
    expect(formatBytes(2_097_152)).toBe('2.0 MB');
  });
});

describe('formatDate', () => {
  it('returns "—" for null or undefined', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
  });

  it('formats ISO strings to pt-BR locale', () => {
    const dateStr = '2023-10-05T14:30:00Z';
    const formatted = formatDate(dateStr);
    expect(formatted).toMatch(/05\/10\/2023/);
  });

  it('formats midday UTC ISO strings without flipping the calendar day', () => {
    expect(formatDate('2023-10-15T12:00:00Z')).toBe('15/10/2023');
    expect(formatDate('2024-02-29T12:00:00Z')).toBe('29/02/2024');
  });
});
