import { describe, expect, it } from 'vitest';
import { resolveExecutionProfile, resolveProfileAppName } from './executionProfile';

describe('resolveExecutionProfile', () => {
  it('is always DEV when unpackaged, regardless of any env var', () => {
    expect(resolveExecutionProfile(false, {})).toBe('DEV');
    expect(resolveExecutionProfile(false, { FC_EXECUTION_PROFILE: 'HOMOLOGATION' })).toBe('DEV');
  });

  it('is PRODUCTION when packaged with no override', () => {
    expect(resolveExecutionProfile(true, {})).toBe('PRODUCTION');
  });

  it('is PRODUCTION when packaged and the override is an empty string', () => {
    expect(resolveExecutionProfile(true, { FC_EXECUTION_PROFILE: '' })).toBe('PRODUCTION');
  });

  it('is HOMOLOGATION when packaged and explicitly requested', () => {
    expect(resolveExecutionProfile(true, { FC_EXECUTION_PROFILE: 'HOMOLOGATION' })).toBe('HOMOLOGATION');
  });

  it('throws on an invalid override instead of silently falling back to PRODUCTION', () => {
    expect(() => resolveExecutionProfile(true, { FC_EXECUTION_PROFILE: 'DEV' })).toThrow();
    expect(() => resolveExecutionProfile(true, { FC_EXECUTION_PROFILE: 'homologation' })).toThrow();
    expect(() => resolveExecutionProfile(true, { FC_EXECUTION_PROFILE: 'production' })).toThrow();
    expect(() => resolveExecutionProfile(true, { FC_EXECUTION_PROFILE: 'anything-else' })).toThrow();
  });
});

describe('resolveProfileAppName', () => {
  it('leaves PRODUCTION byte-identical to the base app name', () => {
    expect(resolveProfileAppName('Formatador Comissão', 'PRODUCTION')).toBe('Formatador Comissão');
  });

  it('suffixes DEV and HOMOLOGATION distinctly from each other and from PRODUCTION', () => {
    const production = resolveProfileAppName('Formatador Comissão', 'PRODUCTION');
    const dev = resolveProfileAppName('Formatador Comissão', 'DEV');
    const homologation = resolveProfileAppName('Formatador Comissão', 'HOMOLOGATION');

    expect(dev).not.toBe(production);
    expect(homologation).not.toBe(production);
    expect(dev).not.toBe(homologation);
    expect(dev.startsWith('Formatador Comissão')).toBe(true);
    expect(homologation.startsWith('Formatador Comissão')).toBe(true);
  });
});
