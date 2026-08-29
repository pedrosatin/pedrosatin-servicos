import { describe, it, expect } from 'vitest';
import { formatBytes } from './format';

describe('formatBytes', () => {
  it('returns em dash for null or undefined', () => {
    expect(formatBytes(null)).toBe('—');
    expect(formatBytes(undefined)).toBe('—');
  });

  it('formats values below 1 MB in KB', () => {
    expect(formatBytes(0)).toBe('0 KB');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(512)).toBe('1 KB'); // 512 / 1024 = 0.5 -> round to 1 KB
    expect(formatBytes(400)).toBe('0 KB'); // 400 / 1024 = 0.39 -> round to 0 KB
    expect(formatBytes(1048575)).toBe('1024 KB');
  });

  it('formats values 1 MB or greater in MB with 1 decimal place', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB');
    expect(formatBytes(1572864)).toBe('1.5 MB'); // 1.5 * 1024 * 1024
    expect(formatBytes(2621440)).toBe('2.5 MB'); // 2.5 * 1024 * 1024
  });
});
