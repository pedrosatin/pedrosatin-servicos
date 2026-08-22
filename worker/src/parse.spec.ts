import { describe, it, expect } from 'vitest';
import { parseHtml } from './parse';

describe('parseHtml JSON-LD error handling', () => {
  it('should extract types using fallback regex when JSON-LD is malformed', () => {
    // Malformed JSON (trailing comma, unquoted value) that causes JSON.parse to throw
    const malformedHtml = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "WebPage",
              "name": "Test Page",
              "description": invalid_unquoted_value,
            }
          </script>
        </head>
        <body></body>
      </html>
    `;

    const report = parseHtml(malformedHtml, 100);
    // Even though JSON.parse fails, the fallback regex should find WebPage
    expect(report.jsonLdTypes).toEqual(['WebPage']);
  });
});
