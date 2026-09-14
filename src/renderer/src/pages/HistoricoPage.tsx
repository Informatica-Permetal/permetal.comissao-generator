import { useEffect, useMemo, useState } from 'react';
import type { ReportMode } from '@shared/constants/folders';
import type { HistoryDocument, HistoryFilters } from '@shared/types/history';

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

interface ActionMessage {
  kind: 'success' | 'error';
  text: string;
}

export default function HistoricoPage({ onBack }: HistoricoPageProps) {
  const [filters, setFilters] = useState<FiltersState>(EMPTY_FILTERS);
  const [documents, setDocuments] = useState<HistoryDocument[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<ActionMessage | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

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
      setLoadError(error instanceof Error ? error.message : 'Falha ao carregar o historico.');
    }
  }

  function updateFilter<K extends keyof FiltersState>(key: K, value: FiltersState[K]): void {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  /** True while ANY operation - batch-level or on one of its own documents - is pending for
   * this batch, so a document-level and a batch-level action on the same batch can never be
   * fired at the same time from the UI (the server also serializes per mode, but disabling
   * here avoids a pointless queued wait and a confusing "nothing happens yet" click). */
  function isBatchBusy(group: BatchGroup): boolean {
    if (busyKey === `batch-${group.batchId}`) return true;
    return group.documents.some((document) => busyKey === `doc-${document.id}`);
  }

  async function handlePrint(pdfPath: string): Promise<void> {
    setActionMessage(null);
    const result = await window.api.pdf.print(pdfPath);
    if (!result.ok) setActionMessage({ kind: 'error', text: result.error ?? 'Falha ao imprimir.' });
  }

  async function handleDeleteDocument(document: HistoryDocument): Promise<void> {
    const confirmed = window.confirm(
      `Excluir o PDF de ${document.sellerName} (${document.branchCode})? O arquivo sera enviado para a lixeira.`
    );
    if (!confirmed) return;
    setBusyKey(`doc-${document.id}`);
    setActionMessage(null);
    try {
      const result = await window.api.history.deleteDocument(document.id);
      setActionMessage(
        result.ok
          ? { kind: 'success', text: 'Documento excluido.' }
          : { kind: 'error', text: result.error ?? 'Falha ao excluir o documento.' }
      );
      await reload();
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRegenerateDocument(document: HistoryDocument): Promise<void> {
    setBusyKey(`doc-${document.id}`);
    setActionMessage(null);
    try {
      const result = await window.api.history.regenerateDocument(document.id);
      if (!result.ok) {
        setActionMessage({
          kind: 'error',
          text:
            result.missingBranchCodes && result.missingBranchCodes.length > 0
              ? `Configure a(s) filial(is) antes de regenerar: ${result.missingBranchCodes.join(', ')}`
              : (result.error ?? 'Falha ao regenerar o documento.')
        });
      } else {
        setActionMessage({ kind: 'success', text: `${result.generatedCount ?? 0} PDF(s) regenerado(s) com sucesso.` });
      }
      await reload();
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteBatch(group: BatchGroup): Promise<void> {
    const confirmed = window.confirm(
      `Excluir o lote inteiro "${group.sourceOriginalName}"? Isso envia ${group.documents.length} PDF(s) e o arquivo de origem arquivado para a lixeira. Esta acao nao pode ser desfeita pelo aplicativo.`
    );
    if (!confirmed) return;
    setBusyKey(`batch-${group.batchId}`);
    setActionMessage(null);
    try {
      const result = await window.api.history.deleteBatch(group.batchId);
      setActionMessage(
        result.ok
          ? { kind: 'success', text: 'Lote excluido.' }
          : { kind: 'error', text: result.error ?? 'Falha ao excluir o lote.' }
      );
      await reload();
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRegenerateBatch(group: BatchGroup): Promise<void> {
    setBusyKey(`batch-${group.batchId}`);
    setActionMessage(null);
    try {
      const result = await window.api.history.regenerateBatch(group.batchId);
      if (!result.ok) {
        setActionMessage({
          kind: 'error',
          text:
            result.missingBranchCodes && result.missingBranchCodes.length > 0
              ? `Configure a(s) filial(is) antes de regenerar: ${result.missingBranchCodes.join(', ')}`
              : (result.error ?? 'Falha ao regenerar o lote.')
        });
      } else {
        setActionMessage({ kind: 'success', text: `${result.generatedCount ?? 0} PDF(s) regenerado(s) com sucesso.` });
      }
      await reload();
    } finally {
      setBusyKey(null);
    }
  }

  const groups = documents ? groupByBatch(documents) : [];

  return (
    <section className="historico-page">
      <h2>Historico</h2>

      <div className="historico-page__filters">
        <label>
          Modo
          <select value={filters.mode} onChange={(e) => updateFilter('mode', e.target.value as ReportMode | '')}>
            <option value="">Todos</option>
            <option value="Previsao">Previsao</option>
            <option value="Relacao">Relacao</option>
          </select>
        </label>
        <label>
          Buscar (arquivo ou lote)
          <input type="text" value={filters.search} onChange={(e) => updateFilter('search', e.target.value)} />
        </label>
        <label>
          Filial
          <input type="text" value={filters.branchCode} onChange={(e) => updateFilter('branchCode', e.target.value)} />
        </label>
        <label>
          Vendedor
          <input type="text" value={filters.sellerCode} onChange={(e) => updateFilter('sellerCode', e.target.value)} />
        </label>
        <label>
          De
          <input type="date" value={filters.dateFrom} onChange={(e) => updateFilter('dateFrom', e.target.value)} />
        </label>
        <label>
          Ate
          <input type="date" value={filters.dateTo} onChange={(e) => updateFilter('dateTo', e.target.value)} />
        </label>
        <button type="button" onClick={() => setFilters(EMPTY_FILTERS)}>
          Limpar filtros
        </button>
      </div>

      {actionMessage && (
        <p
          className={
            actionMessage.kind === 'error'
              ? 'historico-page__message historico-page__message--error'
              : 'historico-page__message'
          }
        >
          {actionMessage.text}
        </p>
      )}
      {loadError && <p className="import-page__error">{loadError}</p>}

      {documents === null && !loadError && <p>Carregando...</p>}

      {documents !== null && groups.length === 0 && <p>Nenhum documento encontrado.</p>}

      {groups.map((group) => (
        <div className="historico-page__batch" key={group.batchId}>
          <div className="historico-page__batch-header">
            <div>
              <strong>{group.sourceOriginalName}</strong>
              <span className="historico-page__batch-mode"> ({group.mode})</span>
            </div>
            <div className="import-page__row-actions">
              <button type="button" disabled={isBatchBusy(group)} onClick={() => void handleRegenerateBatch(group)}>
                Gerar novamente (lote)
              </button>
              <button type="button" disabled={isBatchBusy(group)} onClick={() => void handleDeleteBatch(group)}>
                Excluir lote
              </button>
            </div>
          </div>

          <table className="import-page__table">
            <thead>
              <tr>
                <th>Filial</th>
                <th>Vendedor</th>
                <th>Linhas</th>
                <th>Total</th>
                <th>Gerado em</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {group.documents.map((document) => (
                <tr key={document.id}>
                  <td>{document.branchCode}</td>
                  <td>
                    {document.sellerName} ({document.sellerCode})
                  </td>
                  <td>{document.sourceRowCount}</td>
                  <td>{document.commissionTotal}</td>
                  <td>{new Date(document.generatedAt).toLocaleString('pt-BR')}</td>
                  <td className="import-page__row-actions">
                    {document.pdfAvailable ? (
                      <>
                        <button type="button" onClick={() => void window.api.pdf.open(document.pdfPath)}>
                          Abrir PDF
                        </button>
                        <button type="button" onClick={() => void window.api.pdf.openFolder(document.pdfPath)}>
                          Abrir local
                        </button>
                        <button type="button" onClick={() => void handlePrint(document.pdfPath)}>
                          Imprimir
                        </button>
                      </>
                    ) : (
                      <span className="import-page__error">PDF indisponivel</span>
                    )}
                    <button
                      type="button"
                      disabled={isBatchBusy(group)}
                      onClick={() => void handleRegenerateDocument(document)}
                    >
                      Gerar novamente
                    </button>
                    <button type="button" disabled={isBatchBusy(group)} onClick={() => void handleDeleteDocument(document)}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <button type="button" onClick={onBack}>
        Voltar
      </button>
    </section>
  );
}
