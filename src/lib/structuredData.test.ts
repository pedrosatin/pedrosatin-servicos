import { describe, it, expect, vi } from 'vitest';
import { buildStructuredData } from './structuredData';

vi.mock('./config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./config')>();
  return {
    ...actual,
    CASE_STUDIES: [
      {
        domain: 'example.com',
        name: 'Test <script>alert(1)</script>',
        segment: 'Test',
        summary: 'Test summary',
      }
    ]
  };
});

describe('buildStructuredData', () => {
  it('should generate valid JSON-LD structure with all required nodes', () => {
    const rawData = buildStructuredData();
    const data = JSON.parse(rawData);

    expect(data['@context']).toBe('https://schema.org');
    expect(data['@graph']).toBeInstanceOf(Array);

    const types = data['@graph'].map((node: { '@type': string }) => node['@type']);

    expect(types).toContain('WebSite');
    expect(types).toContain('Person');
    expect(types).toContain('ProfessionalService');
    expect(types).toContain('WebPage');
    expect(types).toContain('FAQPage');
    expect(types).toContain('ItemList');
  });

  it('should correctly escape < characters to prevent XSS in JSON-LD', () => {
    const rawData = buildStructuredData();

    // Check that the output does not contain any literal < characters
    expect(rawData).not.toContain('<');

    // Check that the < character was properly escaped to \u003c
    expect(rawData).toContain('\\u003cscript>alert(1)\\u003c/script>');
  });
});
