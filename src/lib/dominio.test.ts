import { describe, it, expect } from 'vitest';
import { isValidDomain } from './dominio';

describe('isValidDomain', () => {
  it.each([
    'example.com',
    'sub.example.com',
    'my-domain.net',
    'a.co',
    '123.com',
    'test-123.com',
    '1.2.3.4.com',
    'a-b-c.com'
  ])('should return true for valid domain: %s', (domain) => {
    expect(isValidDomain(domain)).toBe(true);
  });

  it.each([
    'example', // no dot
    '.example.com', // starts with dot
    'example.com.', // ends with dot
    'example..com', // double dot
    '-example.com', // starts with hyphen
    'example-.com', // ends with hyphen
    'example_domain.com', // invalid character _
    'http://example.com', // protocol
    'example.com/path', // path
    'EXAMPLE.COM', // uppercase
    'example com', // space
    '', // empty string
  ])('should return false for invalid domain: %s', (domain) => {
    expect(isValidDomain(domain)).toBe(false);
  });
});
