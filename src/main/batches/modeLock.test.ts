import { describe, expect, it } from 'vitest';
import { withModeLock } from './modeLock';

describe('withModeLock', () => {
  it('serializa chamadas com a mesma chave - a segunda so comeca depois que a primeira termina', async () => {
    const events: string[] = [];

    const first = withModeLock('Previsao', async () => {
      events.push('first:start');
      await new Promise((resolve) => setTimeout(resolve, 20));
      events.push('first:end');
      return 'first';
    });

    const second = withModeLock('Previsao', async () => {
      events.push('second:start');
      events.push('second:end');
      return 'second';
    });

    const results = await Promise.all([first, second]);

    expect(results).toEqual(['first', 'second']);
    expect(events).toEqual(['first:start', 'first:end', 'second:start', 'second:end']);
  });

  it('chaves diferentes rodam em paralelo, sem esperar uma pela outra', async () => {
    const events: string[] = [];

    const previsao = withModeLock('Previsao', async () => {
      events.push('previsao:start');
      await new Promise((resolve) => setTimeout(resolve, 20));
      events.push('previsao:end');
    });

    const relacao = withModeLock('Relacao', async () => {
      events.push('relacao:start');
      events.push('relacao:end');
    });

    await Promise.all([previsao, relacao]);

    // relacao (sem delay) termina antes de previsao (com delay) - prova que nao esperou a fila da outra chave.
    expect(events.indexOf('relacao:end')).toBeLessThan(events.indexOf('previsao:end'));
  });

  it('uma chamada que rejeita nao trava a fila - a proxima chamada com a mesma chave roda normalmente', async () => {
    const failing = withModeLock('Previsao', async () => {
      throw new Error('falha proposital');
    });
    await expect(failing).rejects.toThrow('falha proposital');

    const next = await withModeLock('Previsao', async () => 'ok depois da falha');
    expect(next).toBe('ok depois da falha');
  });
});
