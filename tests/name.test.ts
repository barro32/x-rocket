import { describe, expect, it } from 'vitest';
import { companyPrefix } from '../src/sim/name';

describe('companyPrefix', () => {
  it('progresses from X through spreadsheet-style names', () => {
    expect(companyPrefix(23)).toBe('X');
    expect(companyPrefix(24)).toBe('Y');
    expect(companyPrefix(25)).toBe('Z');
    expect(companyPrefix(26)).toBe('AA');
    expect(companyPrefix(27)).toBe('AB');
    expect(companyPrefix(51)).toBe('AZ');
    expect(companyPrefix(52)).toBe('BA');
  });
});
