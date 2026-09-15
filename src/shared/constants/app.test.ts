import { describe, expect, it } from 'vitest';
import { APP_NAME } from './app';

describe('APP_NAME', () => {
  it('keeps the product name exactly "Formatador Comissão" (SKILL.md rule 1)', () => {
    expect(APP_NAME).toBe('Formatador Comissão');
  });
});
