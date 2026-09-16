import { useEffect, useMemo, useState } from 'react';
import { History, FileText, FolderOpen, Printer, RefreshCw, Trash2, FilterX, Inbox } from 'lucide-react';
import type { ReportMode } from '@shared/constants/folders';
import type { HistoryDocument, HistoryFilters } from '@shared/types/history';
import PageHeader from '../components/PageHeader';
import { useToast } from '../components/ToastProvider';
import { useConfirmDialog } from '../components/ConfirmDialogProvider';
import { modeDisplayLabel } from '../lib/modeLabel';

interface HistoricoPageProps {
  onBack: () => void;
}

interface FiltersState {
  mode: ReportMode | '';
  search: string;
  branchCode: string;
  sellerCode: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: FiltersState = {
  mode: '',
  search: '',
  branchCode: '',
  sellerCode: '',
  dateFrom: '',
  dateTo: ''
};

function toHistoryFilters(filters: FiltersState): HistoryFilters {
  const result: HistoryFilters = {};
  if (filters.mode) result.mode = filters.mode;
  if (filters.search.trim()) result.search = filters.search.trim();
  if (filters.branchCode.trim()) result.branchCode = filters.branchCode.trim();
  if (filters.sellerCode.trim()) result.sellerCode = filters.sellerCode.trim();
  if (filters.dateFrom) result.dateFrom = filters.dateFrom;
  if (filters.dateTo) result.dateTo = filters.dateTo;
  return result;
}

interface BatchGroup {
  batchId: string;
  mode: ReportMode;
  sourceOriginalName: string;
  documents: HistoryDocument[];
}

function groupByBatch(documents: HistoryDocument[]): BatchGroup[] {
  const groups = new Map<string, BatchGroup>();
  for (const document of documents) {
    let group = groups.get(document.batchId);
    if (!group) {
      group = {
        batchId: document.batchId,
        mode: document.mode,
        sourceOriginalName: document.sourceOriginalName,
        documents: []
      };
      groups.set(document.batchId, group);
    }
    group.documents.push(document);
  }
  return [...groups.values()];
}

export default function HistoricoPage({ onBack }: HistoricoPageProps) {
  const [filters, setFilters] = useState<FiltersState>(EMPTY_FILTERS);
  const [documents, setDocuments] = useState<HistoryDocument[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const { showToast } = useToast();
  const confirm = useConfirmDialog();

  const historyFilters = useMemo(() => toHistoryFilters(filters), [filters]);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyFilters.mode, historyFilters.search, historyFilters.branchCode, historyFilters.sellerCode, historyFilters.dateFrom, historyFilters.dateTo]);

  async function reload(): Promise<void> {
    try {
      const result = await window.api.history.list(historyFilters);
      setDocuments(result);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Falha ao carregar o histórico.');
    }
  }

  function updateFilter<K extends keyof FiltersState>(key: K, value: FiltersState[K]): void {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  /** True while ANY operation - batch-level or on one of its own documents - is pending for
   * this batch, so a document-level and a batch-level action on the same batch can never be
   * fired at the same time from the UI. */
  function isBatchBusy(group: BatchGroup): boolean {
    if (busyKey === `batch-${group.batchId}`) return true;
    return group.documents.some((document) => busyKey === `doc-${document.id}`);
  }

  async function handlePrint(pdfPath: string): Promise<void> {
    const result = await window.api.pdf.print(pdfPath);
    if (!result.ok) showToast('error', result.error ?? 'Falha ao imprimir.');
  }

  async function handleDeleteDocument(document: HistoryDocument): Promise<void> {
    const branchesLabel =
      document.groupingMode === 'consolidated_by_seller'
        ? `filiais ${document.branches.map((branch) => branch.branchCode).join(', ')}`
        : `filial ${document.branchCode}`;
    const confirmed = await confirm({
      title: 'Excluir documento',
      message: `Excluir o PDF de ${document.sellerName} (${branchesLabel})? O arquivo será enviado para a lixeira.`,
      confirmLabel: 'Excluir'
    });
    if (!confirmed) return;
    setBusyKey(`doc-${document.id}`);
    try {
      const result = await window.api.history.deleteDocument(document.id);
      showToast(result.ok ? 'success' : 'error', result.ok ? 'Documento excluído.' : (result.error ?? 'Falha ao excluir o documento.'));
      await reload();
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRegenerateDocument(document: HistoryDocument): Promise<void> {
    setBusyKey(`doc-${document.id}`);
    try {
      const result = await window.api.history.regenerateDocument(document.id);
      if (!result.ok) {
        showToast(
          'error',
          result.missingBranchCodes && result.missingBranchCodes.length > 0
            ? `Configure a(s) filial(is) antes de regenerar: ${result.missingBranchCodes.join(', ')}`
            : (result.error ?? 'Falha ao regenerar o documento.')
        );
      } else {
        showToast('success', `${result.generatedCount ?? 0} PDF(s) regenerado(s) com sucesso.`);
      }
      await reload();
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteBatch(group: BatchGroup): Promise<void> {
    const confirmed = await confirm({
      title: 'Excluir lote',
      message: `Excluir o lote inteiro "${group.sourceOriginalName}"? Isso envia ${group.documents.length} PDF(s) e o arquivo de origem arquivado para a lixeira. Esta ação não pode ser desfeita pelo aplicativo.`,
      confirmLabel: 'Excluir lote'
    });
    if (!confirmed) return;
    setBusyKey(`batch-${group.batchId}`);
    try {
      const result = await window.api.history.deleteBatch(group.batchId);
      showToast(result.ok ? 'success' : 'error', result.ok ? 'Lote excluído.' : (result.error ?? 'Falha ao excluir o lote.'));
      await reload();
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRegenerateBatch(group: BatchGroup): Promise<void> {
    setBusyKey(`batch-${group.batchId}`);
    try {
      const result = await window.api.history.regenerateBatch(group.batchId);
      if (!result.ok) {
        showToast(
          'error',
          result.missingBranchCodes && result.missingBranchCodes.length > 0
            ? `Configure a(s) filial(is) antes de regenerar: ${result.missingBranchCodes.join(', ')}`
            : (result.error ?? 'Falha ao regenerar o lote.')
        );
      } else {
        showToast('success', `${result.generatedCount ?? 0} PDF(s) regenerado(s) com sucesso.`);
      }
      await reload();
    } finally {
      setBusyKey(null);
    }
  }

  const groups = documents ? groupByBatch(documents) : [];

  return (
    <section>
      <PageHeader icon={History} title="Histórico" onBack={onBack} />

      <div className="card historico-toolbar">
        <div className="field">
          <label htmlFor="hist-mode">Modo</label>
          <select id="hist-mode" value={filters.mode} onChange={(e) => updateFilter('mode', e.target.value as ReportMode | '')}>
            <option value="">Todos</option>
            <option value="Previsao">Previsão</option>
            <option value="Relacao">Relação</option>
          </select>
        </div>
        <div className="field field--search">
          <label htmlFor="hist-search">Buscar (arquivo ou lote)</label>
          <input id="hist-search" type="text" value={filters.search} onChange={(e) => updateFilter('search', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="hist-branch">Filial</label>
          <input id="hist-branch" type="text" value={filters.branchCode} onChange={(e) => updateFilter('branchCode', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="hist-seller">Vendedor</label>
          <input id="hist-seller" type="text" value={filters.sellerCode} onChange={(e) => updateFilter('sellerCode', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="hist-from">De</label>
          <input id="hist-from" type="date" value={filters.dateFrom} onChange={(e) => updateFilter('dateFrom', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="hist-to">Até</label>
          <input id="hist-to" type="date" value={filters.dateTo} onChange={(e) => updateFilter('dateTo', e.target.value)} />
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setFilters(EMPTY_FILTERS)}>
          <FilterX size={14} /> Limpar filtros
        </button>
      </div>

      {loadError && <div className="message-banner message-banner--error">{loadError}</div>}

      {documents === null && !loadError && (
        <div className="loading-row">
          <span className="spinner" />
          Carregando...
        </div>
      )}

      {documents !== null && groups.length === 0 && (
        <div className="card empty-state">
          <Inbox size={28} />
          <p className="empty-state__title">Nenhum documento encontrado</p>
          <p className="empty-state__hint">Ajuste os filtros ou gere novos documentos a partir de Previsão ou Relação.</p>
        </div>
      )}

      {groups.map((group) => (
        <div className="card batch-card" key={group.batchId}>
          <div className="batch-card__header">
            <div className="batch-card__title">
              <FileText size={16} />
              {group.sourceOriginalName}
              <span className="badge">{modeDisplayLabel(group.mode)}</span>
            </div>
            <div className="batch-card__actions">
              <button
                type="button"
                className="btn btn--sm"
                disabled={isBatchBusy(group)}
                onClick={() => void handleRegenerateBatch(group)}
              >
                <RefreshCw size={13} /> Gerar novamente (lote)
              </button>
              <button
                type="button"
                className="btn btn--sm btn--danger"
                disabled={isBatchBusy(group)}
                onClick={() => void handleDeleteBatch(group)}
              >
                <Trash2 size={13} /> Excluir lote
              </button>
            </div>
          </div>

          <div className="data-table-wrap" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Filial</th>
                  <th>Vendedor</th>
                  <th>Linhas</th>
                  <th className="num">Total</th>
                  <th>Gerado em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {group.documents.map((document) => (
                  <tr key={document.id}>
                    <td>
                      {document.groupingMode === 'consolidated_by_seller' ? (
                        <>
                          <span className="badge badge--consolidated">Consolidado</span>
                          <div className="doc-branches-list">
                            {document.branches.map((branch) => branch.branchCode).join(', ')}
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="badge badge--separado">Separado</span>
                          <div className="doc-branches-list">{document.branchCode}</div>
                        </>
                      )}
                    </td>
                    <td>
                      {document.sellerName} ({document.sellerCode})
                    </td>
                    <td>{document.sourceRowCount}</td>
                    <td className="num">{document.commissionTotal}</td>
                    <td>{new Date(document.generatedAt).toLocaleString('pt-BR')}</td>
                    <td>
                      <div className="data-table__actions">
                        {document.pdfAvailable ? (
                          <>
                            <button
                              type="button"
                              className="icon-btn"
                              data-tooltip="Abrir PDF"
                              onClick={() => void window.api.pdf.open(document.pdfPath)}
                            >
                              <FileText size={16} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn"
                              data-tooltip="Abrir pasta"
                              onClick={() => void window.api.pdf.openFolder(document.pdfPath)}
                            >
                              <FolderOpen size={16} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn"
                              data-tooltip="Imprimir"
                              onClick={() => void handlePrint(document.pdfPath)}
                            >
                              <Printer size={16} />
                            </button>
                          </>
                        ) : (
                          <span className="unavailable-tag">PDF indisponível</span>
                        )}
                        <button
                          type="button"
                          className="icon-btn"
                          data-tooltip="Gerar novamente"
                          disabled={isBatchBusy(group)}
                          onClick={() => void handleRegenerateDocument(document)}
                        >
                          <RefreshCw size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          data-tooltip="Excluir"
                          disabled={isBatchBusy(group)}
                          onClick={() => void handleDeleteDocument(document)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}
