import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { computePeriodoAnalise, escapeHtml, formatCurrencyBRL, formatDateBR, formatPercent } from './format';

describe('formatCurrencyBRL', () => {
  it('formata valores simples', () => {
    expect(formatCurrencyBRL(new Decimal('140'))).toBe('R$ 140,00');
  });

  it('formata milhares corretamente', () => {
    expect(formatCurrencyBRL(new Decimal('1234567.89'))).toBe('R$ 1.234.567,89');
  });

  it('formata negativos com o sinal antes de R$', () => {
    expect(formatCurrencyBRL(new Decimal('-50'))).toBe('-R$ 50,00');
  });

  it('arredonda para 2 casas mantendo o valor interno de alta precisao', () => {
    expect(formatCurrencyBRL(new Decimal('7.93129527965909'))).toBe('R$ 7,93');
  });

  it('mostra "-" para valor nulo (celula em branco)', () => {
    expect(formatCurrencyBRL(null)).toBe('-');
  });
});

describe('formatPercent', () => {
  it('exibe o percentual exatamente como veio da fonte, sem recalcular', () => {
    expect(formatPercent(new Decimal('0.35'))).toBe('0,35%');
    expect(formatPercent(new Decimal('0.18'))).toBe('0,18%');
  });

  it('mostra "-" para percentual nulo', () => {
    expect(formatPercent(null)).toBe('-');
  });
});

describe('formatDateBR', () => {
  it('formata dd/MM/yyyy usando os componentes UTC', () => {
    expect(formatDateBR(new Date(Date.UTC(2026, 7, 6)))).toBe('06/08/2026');
  });

  it('mostra "-" para data nula', () => {
    expect(formatDateBR(null)).toBe('-');
  });
});

describe('computePeriodoAnalise', () => {
  it('retorna a menor e a maior data validas, formatadas', () => {
    expect(
      computePeriodoAnalise([new Date(Date.UTC(2026, 7, 10)), new Date(Date.UTC(2026, 5, 1)), new Date(Date.UTC(2026, 8, 20))])
    ).toBe('01/06/2026 a 20/09/2026');
  });

  it('ignora datas nulas ao calcular o intervalo', () => {
    expect(computePeriodoAnalise([null, new Date(Date.UTC(2026, 7, 10)), null, new Date(Date.UTC(2026, 5, 1))])).toBe(
      '01/06/2026 a 10/08/2026'
    );
  });

  it('retorna "Não informado" quando nao ha nenhuma data valida', () => {
    expect(computePeriodoAnalise([null, null])).toBe('Não informado');
    expect(computePeriodoAnalise([])).toBe('Não informado');
  });

  it('funciona com uma unica data valida (menor e maior sao a mesma)', () => {
    expect(computePeriodoAnalise([new Date(Date.UTC(2026, 7, 10))])).toBe('10/08/2026 a 10/08/2026');
  });

  it('nunca deriva o intervalo de menos datas do que as fornecidas - todas as validas contam', () => {
    // Garantia de que a funcao apenas RESUME o intervalo, nunca filtra: passar 5 datas
    // sempre produz o mesmo min/max independente da ordem ou de quantas repetem.
    const dates = [
      new Date(Date.UTC(2026, 0, 15)),
      new Date(Date.UTC(2026, 0, 15)),
      new Date(Date.UTC(2026, 11, 31)),
      new Date(Date.UTC(2026, 5, 1))
    ];
    expect(computePeriodoAnalise(dates)).toBe('15/01/2026 a 31/12/2026');
  });
});

describe('escapeHtml', () => {
  it('escapa caracteres especiais para uso seguro em HTML', () => {
    expect(escapeHtml('<script>alert("x")</script> & \'oi\'')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;oi&#39;'
    );
  });
});
