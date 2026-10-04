import { describe, it, expect } from 'vitest';
import { CASE_STUDIES } from './config';

describe('CASE_STUDIES', () => {
  it('has valid domain matching domain regex for every entry', () => {
    const domainRegex = /^[a-z0-9.-]+\.[a-z]{2,}$/i;
    expect(CASE_STUDIES.length).toBeGreaterThan(0);
    for (const study of CASE_STUDIES) {
      expect(study.domain).toMatch(domainRegex);
    }
  });

  it('has non-empty strings for name, segment, and summary for every entry', () => {
    for (const study of CASE_STUDIES) {
      expect(typeof study.name).toBe('string');
      expect(study.name.trim().length).toBeGreaterThan(0);
      expect(typeof study.segment).toBe('string');
      expect(study.segment.trim().length).toBeGreaterThan(0);
      expect(typeof study.summary).toBe('string');
      expect(study.summary.trim().length).toBeGreaterThan(0);
    }
  });

  it('contains no duplicate domains', () => {
    const domains = CASE_STUDIES.map((study) => study.domain.toLowerCase());
    const uniqueDomains = new Set(domains);
    expect(uniqueDomains.size).toBe(domains.length);
  });
});
