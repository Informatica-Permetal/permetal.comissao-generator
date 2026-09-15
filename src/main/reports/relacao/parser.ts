import type ExcelJS from 'exceljs';
import Decimal from 'decimal.js';
import {
  collectNormalizedHeaders,
  headersIncludeAllMarkers,
  locateAndMatchHeaders,
  matchOptionalHeaders
} from '../common/contractValidation';
import { MissingHeadersError, WrongModeError } from '../common/errors';
import { getFirstWorksheet, loadWorkbookFromFile } from '../common/workbookLoader';
import { parseBrazilianDecimal } from '../common/numbers';
import { parseCalendarDate } from '../common/dates';
import { cellToNullableTrimmedString, cellToTrimmedString, normalizeHeader } from '../common/text';
import { groupRows, type DocumentGroup } from '../common/grouping';
import { warnIfNameInconsistent } from '../common/nameConsistency';
import {
  EXPECTED_ORIGEM_BE,
  EXPECTED_TIPO_DE_REGISTRO,
  PREVISAO_MARKERS,
  RELACAO_FIELDS,
  RELACAO_OPTIONAL_FIELDS,
  RELACAO_TOTAL_FIELD_KEY
} from './contract';

export interface RelacaoParsedRow {
  sourceRowNumber: number;
  tipoDeRegistro: string;
  nomeDoVendedor: string;
  filialCodigo: string;
  vendedorCodigo: string;
  prefixo: string | null;
  numeroDoTituloOriginal: string | null;
  parcela: string | null;
  nomeDoCliente: string | null;
  dataDeBaixaDoTitulo: Date | null;
  dataDoPgtoDaComissao: Date | null;
  numeroDoPedido: string | null;
  valorBaseDaComissao: Decimal | null;
  percentComissaoSobreVlBase: Decimal | null;
  /** The ONLY field summed for the Relacao document total. */
  valorDaComissao: Decimal | null;
  comissaoGeradaPelaBE: string | null;
}

export interface RelacaoParseResult {
  headerRowNumber: number;
  rows: RelacaoParsedRow[];
  groups: DocumentGroup<RelacaoParsedRow>[];
  warnings: string[];
}

export async function parseRelacaoFile(filePath: string): Promise<RelacaoParseResult> {
  const workbook = await loadWorkbookFromFile(filePath);
  return parseRelacaoWorksheet(getFirstWorksheet(workbook));
}

export function parseRelacaoWorksheet(sheet: ExcelJS.Worksheet): RelacaoParseResult {
  const validation = locateAndMatchHeaders(sheet, RELACAO_FIELDS);

  if (validation.missingFields.length > 0) {
    const headers = collectNormalizedHeaders(sheet);
    if (headersIncludeAllMarkers(headers, PREVISAO_MARKERS)) {
      throw new WrongModeError('Relacao', 'Previsao');
    }
    throw new MissingHeadersError(
      'Relacao',
      validation.missingFields.map((field) => field.canonicalHeader)
    );
  }

  const columnByKey = new Map(validation.matches.map((match) => [match.field.key, match.columnNumber]));
  for (const match of matchOptionalHeaders(sheet, validation.headerRowNumber, RELACAO_OPTIONAL_FIELDS)) {
    columnByKey.set(match.field.key, match.columnNumber);
  }
  const warnings: string[] = [];
  const knownNameByCode = new Map<string, string>();
  const rows: RelacaoParsedRow[] = [];

  for (let rowNumber = validation.headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber++) {
    const excelRow = sheet.getRow(rowNumber);
    if (excelRow.cellCount === 0) continue;

    /** Optional fields may have no column at all - never call getCell(undefined). */
    const cellValue = (key: string): ExcelJS.CellValue | null => {
      const columnNumber = columnByKey.get(key);
      return columnNumber == null ? null : excelRow.getCell(columnNumber).value;
    };
    const cell = (key: string) => excelRow.getCell(columnByKey.get(key) as number);

    const filialCodigo = cellToTrimmedString(cell('filialDoSistema').value);
    const vendedorCodigo = cellToTrimmedString(cell('codigoDoVendedor').value);
    const nomeDoVendedor = cellToTrimmedString(cell('nomeDoVendedor').value);
    const tipoDeRegistro = cellToTrimmedString(cellValue('tipoDeRegistro'));
    const comissaoGeradaPelaBE = cellToNullableTrimmedString(cellValue('comissaoGeradaPelaBE'));

    if (filialCodigo === '' && vendedorCodigo === '') continue; // fully blank trailing row

    warnIfNameInconsistent(
      knownNameByCode,
      `vendedor|${vendedorCodigo}`,
      nomeDoVendedor,
      warnings,
      rowNumber
    );

    if (tipoDeRegistro !== '' && normalizeHeader(tipoDeRegistro) !== normalizeHeader(EXPECTED_TIPO_DE_REGISTRO)) {
      warnings.push(
        `Linha ${rowNumber}: "Tipo de Registro" inesperado ("${tipoDeRegistro}") - linha preservada.`
      );
    }
    if (
      comissaoGeradaPelaBE !== null &&
      normalizeHeader(comissaoGeradaPelaBE) !== normalizeHeader(EXPECTED_ORIGEM_BE)
    ) {
      warnings.push(
        `Linha ${rowNumber}: "Comissao gerada pela B/E" inesperado ("${comissaoGeradaPelaBE}") - linha preservada.`
      );
    }

    rows.push({
      sourceRowNumber: rowNumber,
      tipoDeRegistro,
      nomeDoVendedor,
      filialCodigo,
      vendedorCodigo,
      prefixo: cellToNullableTrimmedString(cell('prefixo').value),
      numeroDoTituloOriginal: cellToNullableTrimmedString(cell('numeroDoTituloOriginal').value),
      parcela: cellToNullableTrimmedString(cell('parcela').value),
      nomeDoCliente: cellToNullableTrimmedString(cell('nomeDoCliente').value),
      dataDeBaixaDoTitulo: parseCalendarDate(cell('dataDeBaixaDoTitulo').value),
      dataDoPgtoDaComissao: parseCalendarDate(cellValue('dataDoPgtoDaComissao')),
      numeroDoPedido: cellToNullableTrimmedString(cell('numeroDoPedido').value),
      valorBaseDaComissao: parseBrazilianDecimal(cell('valorBaseDaComissao').value, 'Valor Base da Comissao'),
      percentComissaoSobreVlBase: parseBrazilianDecimal(
        cell('percentComissaoSobreVlBase').value,
        '% Comissao sobre Vl.Base'
      ),
      valorDaComissao: parseBrazilianDecimal(cell(RELACAO_TOTAL_FIELD_KEY).value, 'Valor da Comissao'),
      comissaoGeradaPelaBE
    });
  }

  const groups = groupRows(
    rows,
    (row) => ({
      branchCode: row.filialCodigo,
      branchName: '',
      sellerCode: row.vendedorCodigo,
      sellerName: row.nomeDoVendedor
    }),
    (row) => row.valorDaComissao ?? new Decimal(0)
  );

  return { headerRowNumber: validation.headerRowNumber, rows, groups, warnings };
}
