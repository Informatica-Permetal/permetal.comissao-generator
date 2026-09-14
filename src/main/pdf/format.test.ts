import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { escapeHtml, formatCurrencyBRL, formatDateBR, formatPercent } from './format';

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

describe('escapeHtml', () => {
  it('escapa caracteres especiais para uso seguro em HTML', () => {
    expect(escapeHtml('<script>alert("x")</script> & \'oi\'')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;oi&#39;'
    );
  });
});
