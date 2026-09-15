import type ExcelJS from 'exceljs';
import Decimal from 'decimal.js';
import {
  collectNormalizedHeaders,
  countNormalizedHeaderOccurrences,
  headersIncludeAllMarkers,
  locateAndMatchHeaders
} from '../common/contractValidation';
import { AmbiguousHeaderError, MissingHeadersError, WrongModeError } from '../common/errors';
import { getFirstWorksheet, loadWorkbookFromFile } from '../common/workbookLoader';
import { parseBrazilianDecimal } from '../common/numbers';
import { parseCalendarDate } from '../common/dates';
import {
  cellToNullableTrimmedString,
  cellToTrimmedString,
  normalizeHeader,
  parseCodeNamePair
} from '../common/text';
import { groupRows, type DocumentGroup } from '../common/grouping';
import { warnIfNameInconsistent } from '../common/nameConsistency';
import { KNOWN_PREVISAO_CLASSIFICATIONS, PREVISAO_FIELDS, PREVISAO_TOTAL_FIELD_KEY, RELACAO_MARKERS } from './contract';

export interface PrevisaoParsedRow {
  sourceRowNumber: number;
  dadosCliente: string | null;
  dadosTitulo: string | null;
  dadosPedido: string | null;
  emissaoPedidoTitulo: Date | null;
  vencimento: Date | null;
  valorBaseParaBaixa: Decimal | null;
  valorTotalComissao: Decimal | null;
  dtBaixa: Date | null;
  valorIrrf: Decimal | null;
  /** The ONLY field summed for the Previsao document total. */
  comissaoTotalLiquido: Decimal | null;
  vendedorCodigo: string;
  vendedorNome: string;
  classificacao: string;
  filialCodigo: string;
  filialNome: string;
}

export interface PrevisaoParseResult {
  headerRowNumber: number;
  rows: PrevisaoParsedRow[];
  groups: DocumentGroup<PrevisaoParsedRow>[];
  warnings: string[];
}

export async function parsePrevisaoFile(filePath: string): Promise<PrevisaoParseResult> {
  const workbook = await loadWorkbookFromFile(filePath);
  return parsePrevisaoWorksheet(getFirstWorksheet(workbook));
}

export function parsePrevisaoWorksheet(sheet: ExcelJS.Worksheet): PrevisaoParseResult {
  const validation = locateAndMatchHeaders(sheet, PREVISAO_FIELDS);

  if (validation.missingFields.length > 0) {
    const headers = collectNormalizedHeaders(sheet);
    if (headersIncludeAllMarkers(headers, RELACAO_MARKERS)) {
      throw new WrongModeError('Previsao', 'Relacao');
    }
    throw new MissingHeadersError(
      'Previsao',
      validation.missingFields.map((field) => field.canonicalHeader)
    );
  }

  /**
   * The Previsao Smart View export can contain two columns both literally
   * named "Vencimento" (an earlier, wrong one and the intended one further
   * down the field list). They are indistinguishable by name, so - unlike
   * every other field - this is never resolved by silently picking one:
   * the import is blocked and the user is told to fix the Smart View
   * selection and re-export.
   */
  const vencimentoOccurrences = countNormalizedHeaderOccurrences(
    sheet,
    validation.headerRowNumber,
    normalizeHeader('Vencimento')
  );
  if (vencimentoOccurrences > 1) {
    throw new AmbiguousHeaderError('Previsao', 'Vencimento', vencimentoOccurrences);
  }

  const columnByKey = new Map(validation.matches.map((match) => [match.field.key, match.columnNumber]));
  const warnings: string[] = [];
  const knownNameByCode = new Map<string, string>();
  const rows: PrevisaoParsedRow[] = [];

  for (let rowNumber = validation.headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber++) {
    const excelRow = sheet.getRow(rowNumber);
    if (excelRow.cellCount === 0) continue;

    const cell = (key: string) => excelRow.getCell(columnByKey.get(key) as number);

    const vendedor = parseCodeNamePair(cell('dadosVendedor').value);
    const filial = parseCodeNamePair(cell('nomeDaFilial').value);
    const classificacao = cellToTrimmedString(cell('classificacao').value);

    if (vendedor.raw === '' && filial.raw === '') continue; // fully blank trailing row

    warnIfNameInconsistent(knownNameByCode, `vendedor|${vendedor.codigo}`, vendedor.nome, warnings, rowNumber);
    warnIfNameInconsistent(knownNameByCode, `filial|${filial.codigo}`, filial.nome, warnings, rowNumber);

    if (classificacao !== '' && !isKnownClassification(classificacao)) {
      warnings.push(
        `Linha ${rowNumber}: classificacao "${classificacao}" nao reconhecida - preservada em secao propria.`
      );
    }

    rows.push({
      sourceRowNumber: rowNumber,
      dadosCliente: cellToNullableTrimmedString(cell('dadosCliente').value),
      dadosTitulo: cellToNullableTrimmedString(cell('dadosTitulo').value),
      dadosPedido: cellToNullableTrimmedString(cell('dadosPedido').value),
      emissaoPedidoTitulo: parseCalendarDate(cell('emissaoPedidoTitulo').value),
      vencimento: parseCalendarDate(cell('vencimento').value),
      valorBaseParaBaixa: parseBrazilianDecimal(cell('valorBaseParaBaixa').value, 'Valor base para baixa'),
      valorTotalComissao: parseBrazilianDecimal(cell('valorTotalComissao').value, 'Valor total de comissao'),
      dtBaixa: parseCalendarDate(cell('dtBaixa').value),
      valorIrrf: parseBrazilianDecimal(cell('valorIrrf').value, 'Valor IRRF'),
      comissaoTotalLiquido: parseBrazilianDecimal(
        cell(PREVISAO_TOTAL_FIELD_KEY).value,
        'Comissao total (liquido)'
      ),
      vendedorCodigo: vendedor.codigo,
      vendedorNome: vendedor.nome,
      classificacao,
      filialCodigo: filial.codigo,
      filialNome: filial.nome
    });
  }

  const groups = groupRows(
    rows,
    (row) => ({
      branchCode: row.filialCodigo,
      branchName: row.filialNome,
      sellerCode: row.vendedorCodigo,
      sellerName: row.vendedorNome
    }),
    (row) => row.comissaoTotalLiquido ?? new Decimal(0)
  );

  return { headerRowNumber: validation.headerRowNumber, rows, groups, warnings };
}

function isKnownClassification(classificacao: string): boolean {
  const normalized = normalizeHeader(classificacao);
  return KNOWN_PREVISAO_CLASSIFICATIONS.some((known) => normalizeHeader(known) === normalized);
}

