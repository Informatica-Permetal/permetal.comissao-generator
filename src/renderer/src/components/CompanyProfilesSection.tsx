import { useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, ImageUp, Plus, Save, Building2, Search, Trash2, X } from 'lucide-react';
import type { CompanyGroup, CompanyProfileWithLogoPreview } from '@shared/types/companyProfile';
import { useToast } from './ToastProvider';
import { useConfirmDialog } from './ConfirmDialogProvider';

interface FieldsState {
  displayName: string;
  legalName: string;
  tradeName: string;
  cnpj: string;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}

function toFields(profile: CompanyProfileWithLogoPreview): FieldsState {
  return {
    displayName: profile.displayName,
    legalName: profile.legalName ?? '',
    tradeName: profile.tradeName ?? '',
    cnpj: profile.cnpj ?? '',
    endereco: profile.address?.endereco ?? '',
    bairro: profile.address?.bairro ?? '',
    cidade: profile.address?.cidade ?? '',
    uf: profile.address?.uf ?? '',
    cep: profile.address?.cep ?? ''
  };
}

function matchesSearch(profile: CompanyProfileWithLogoPreview, term: string): boolean {
  if (!term) return true;
  const haystack = [profile.branchCode, profile.displayName, profile.legalName, profile.tradeName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(term.toLowerCase());
}

export default function CompanyProfilesSection() {
  const [profiles, setProfiles] = useState<CompanyProfileWithLogoPreview[] | null>(null);
  const [groups, setGroups] = useState<CompanyGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [search, setSearch] = useState('');
  const { showToast } = useToast();
  const confirm = useConfirmDialog();

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh(): Promise<void> {
    try {
      const [list, groupList] = await Promise.all([window.api.companies.list(), window.api.companies.listGroups()]);
      setProfiles(list);
      setGroups(groupList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar as filiais.');
    }
  }

  async function handleChooseLogo(branchCode: string): Promise<void> {
    const updated = await window.api.companies.chooseLogo(branchCode);
    if (updated) {
      await refresh();
      showToast('success', 'Logo atualizada.');
    }
  }

  async function handleSave(branchCode: string, active: boolean, groupKey: string | null, fields: FieldsState): Promise<void> {
    try {
      await window.api.companies.upsert({
        branchCode,
        displayName: fields.displayName,
        legalName: fields.legalName || null,
        tradeName: fields.tradeName || null,
        cnpj: fields.cnpj || null,
        address: {
          endereco: fields.endereco,
          bairro: fields.bairro,
          cidade: fields.cidade,
          uf: fields.uf,
          cep: fields.cep
        },
        groupKey,
        active
      });
      await refresh();
      showToast('success', `Filial ${branchCode} atualizada.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Falha ao salvar a filial.');
    }
  }

  async function handleToggleActive(profile: CompanyProfileWithLogoPreview): Promise<void> {
    try {
      await window.api.companies.setActive(profile.branchCode, !profile.active);
      await refresh();
      showToast('success', profile.active ? `Filial ${profile.branchCode} desativada.` : `Filial ${profile.branchCode} ativada.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Falha ao alterar o status da filial.');
    }
  }

  async function handleDelete(profile: CompanyProfileWithLogoPreview): Promise<void> {
    const confirmed = await confirm({
      title: 'Excluir filial',
      message: `Excluir a filial ${profile.branchCode} — ${profile.displayName}? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir'
    });
    if (!confirmed) return;

    try {
      const result = await window.api.companies.delete(profile.branchCode);
      if (!result.ok) {
        showToast(
          'error',
          `Esta filial tem ${result.documentCount} documento(s) no histórico e não pode ser excluída. Desative-a em vez disso.`
        );
        return;
      }
      await refresh();
      showToast('success', `Filial ${profile.branchCode} excluída.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Falha ao excluir a filial.');
    }
  }

  async function handleAddBranch(branchCode: string, displayName: string, groupKey: string | null): Promise<void> {
    await window.api.companies.upsert({ branchCode, displayName, groupKey, active: true });
    await refresh();
    setShowAddForm(false);
    showToast('success', `Filial ${branchCode} adicionada.`);
  }

  const filtered = useMemo(() => (profiles ?? []).filter((p) => matchesSearch(p, search)), [profiles, search]);

  const sections = useMemo(() => {
    const groupOrder = new Map(groups.map((g, index) => [g.groupKey, index]));
    const byGroup = new Map<string, CompanyProfileWithLogoPreview[]>();
    for (const profile of filtered) {
      const key = profile.groupKey ?? '__sem_grupo__';
      const list = byGroup.get(key) ?? [];
      list.push(profile);
      byGroup.set(key, list);
    }
    return Array.from(byGroup.entries())
      .sort(([a], [b]) => {
        if (a === '__sem_grupo__') return 1;
        if (b === '__sem_grupo__') return -1;
        return (groupOrder.get(a) ?? 99) - (groupOrder.get(b) ?? 99);
      })
      .map(([key, list]) => ({
        key,
        title: key === '__sem_grupo__' ? 'Sem grupo' : groups.find((g) => g.groupKey === key)?.displayName ?? key,
        profiles: list
      }));
  }, [filtered, groups]);

  if (error) return <div className="message-banner message-banner--error">{error}</div>;
  if (!profiles) {
    return (
      <div className="loading-row">
        <span className="spinner" />
        Carregando filiais...
      </div>
    );
  }

  return (
    <div className="company-profiles">
      <div className="company-search">
        <Search size={16} className="company-search__icon" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código ou nome..."
          aria-label="Buscar filial por código ou nome"
        />
      </div>

      {sections.map((section) => (
        <div key={section.key} className="company-group-section">
          <div className="company-group-section__title">{section.title}</div>
          <div className="company-group-section__cards">
            {section.profiles.map((profile) => (
              <CompanyCard
                key={profile.branchCode}
                profile={profile}
                onChooseLogo={() => void handleChooseLogo(profile.branchCode)}
                onSave={(fields) => handleSave(profile.branchCode, profile.active, profile.groupKey, fields)}
                onToggleActive={() => void handleToggleActive(profile)}
                onDelete={() => void handleDelete(profile)}
              />
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && <p className="company-profiles__empty">Nenhuma filial encontrada para "{search}".</p>}

      {showAddForm ? (
        <AddBranchCard groups={groups} onCancel={() => setShowAddForm(false)} onAdd={handleAddBranch} />
      ) : (
        <button type="button" className="card add-branch-card" onClick={() => setShowAddForm(true)}>
          <Plus size={18} />
          Nova filial
        </button>
      )}
    </div>
  );
}

function CompanyCard({
  profile,
  onChooseLogo,
  onSave,
  onToggleActive,
  onDelete
}: {
  profile: CompanyProfileWithLogoPreview;
  onChooseLogo: () => void;
  onSave: (fields: FieldsState) => Promise<void>;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const [fields, setFields] = useState<FieldsState>(() => toFields(profile));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFields(toFields(profile));
  }, [profile]);

  function update<K extends keyof FieldsState>(key: K, value: string): void {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSaveClick(): Promise<void> {
    setSaving(true);
    try {
      await onSave(fields);
    } finally {
      setSaving(false);
    }
  }

  const id = profile.branchCode;

  return (
    <article className={`company-card card${profile.active ? '' : ' company-card--inactive'}`}>
      <header className="company-card__header">
        <div className="company-card__logo-wrap">
          {profile.logoDataUri ? (
            <img className="company-card__logo" src={profile.logoDataUri} alt={profile.displayName} />
          ) : (
            <div className="company-card__logo company-card__logo--empty">
              <Building2 size={18} />
            </div>
          )}
        </div>
        <div className="company-card__identity">
          <div className="company-card__badges">
            <span className="badge badge--code">{profile.branchCode}</span>
            {!profile.active && <span className="badge badge--inactive">Inativa</span>}
          </div>
          <div className="company-card__name">{fields.displayName || profile.displayName}</div>
        </div>
        <div className="company-card__logo-action">
          <button type="button" className="btn btn--sm btn--ghost" onClick={onChooseLogo}>
            <ImageUp size={14} /> Trocar logo
          </button>
        </div>
      </header>

      <div className="company-card__body">
        <div className="company-card__group">
          <div className="company-card__group-title">Identificação</div>
          <div className="company-card__fields">
            <div className="field">
              <label htmlFor={`${id}-displayName`}>Nome de exibição</label>
              <input
                id={`${id}-displayName`}
                value={fields.displayName}
                onChange={(e) => update('displayName', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor={`${id}-legalName`}>Razão social</label>
              <input
                id={`${id}-legalName`}
                value={fields.legalName}
                onChange={(e) => update('legalName', e.target.value)}
                placeholder="Não informado"
              />
            </div>
            <div className="field">
              <label htmlFor={`${id}-tradeName`}>Nome fantasia</label>
              <input
                id={`${id}-tradeName`}
                value={fields.tradeName}
                onChange={(e) => update('tradeName', e.target.value)}
                placeholder="Não informado"
              />
            </div>
            <div className="field">
              <label htmlFor={`${id}-cnpj`}>CNPJ</label>
              <input
                id={`${id}-cnpj`}
                value={fields.cnpj}
                onChange={(e) => update('cnpj', e.target.value)}
                placeholder="Não informado"
              />
            </div>
          </div>
        </div>

        <div className="company-card__group">
          <div className="company-card__group-title">Endereço</div>
          <div className="company-card__fields company-card__fields--address">
            <div className="field">
              <label htmlFor={`${id}-endereco`}>Endereço</label>
              <input
                id={`${id}-endereco`}
                value={fields.endereco}
                onChange={(e) => update('endereco', e.target.value)}
                placeholder="Não informado"
              />
            </div>
            <div className="field">
              <label htmlFor={`${id}-bairro`}>Bairro</label>
              <input
                id={`${id}-bairro`}
                value={fields.bairro}
                onChange={(e) => update('bairro', e.target.value)}
                placeholder="Não informado"
              />
            </div>
            <div className="field">
              <label htmlFor={`${id}-cidade`}>Cidade</label>
              <input
                id={`${id}-cidade`}
                value={fields.cidade}
                onChange={(e) => update('cidade', e.target.value)}
                placeholder="Não informado"
              />
            </div>
            <div className="field">
              <label htmlFor={`${id}-uf`}>UF</label>
              <input
                id={`${id}-uf`}
                value={fields.uf}
                maxLength={2}
                onChange={(e) => update('uf', e.target.value.toUpperCase())}
                placeholder="-"
              />
            </div>
            <div className="field">
              <label htmlFor={`${id}-cep`}>CEP</label>
              <input
                id={`${id}-cep`}
                value={fields.cep}
                onChange={(e) => update('cep', e.target.value)}
                placeholder="Não informado"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onToggleActive}>
          {profile.active ? (
            <>
              <Ban size={14} /> Desativar
            </>
          ) : (
            <>
              <CheckCircle2 size={14} /> Ativar
            </>
          )}
        </button>
        <button type="button" className="btn btn--ghost btn--sm btn--danger" onClick={onDelete}>
          <Trash2 size={14} /> Excluir
        </button>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => void handleSaveClick()}
          disabled={saving}
        >
          <Save size={14} /> {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>
    </article>
  );
}

function AddBranchCard({
  groups,
  onCancel,
  onAdd
}: {
  groups: CompanyGroup[];
  onCancel: () => void;
  onAdd: (branchCode: string, displayName: string, groupKey: string | null) => Promise<void>;
}) {
  const [branchCode, setBranchCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [groupKey, setGroupKey] = useState('');
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function handleAdd(): Promise<void> {
    if (!branchCode.trim() || !displayName.trim()) {
      showToast('error', 'Informe o código e o nome da filial.');
      return;
    }
    setSaving(true);
    try {
      await onAdd(branchCode.trim(), displayName.trim(), groupKey || null);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Falha ao adicionar filial.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ padding: 'var(--space-5)' }}>
      <div className="company-card__group-title">Nova filial</div>
      <div className="add-branch-card__form">
        <div className="field field--grow">
          <label htmlFor="new-branch-code">Código da filial</label>
          <input id="new-branch-code" value={branchCode} onChange={(e) => setBranchCode(e.target.value)} placeholder="ex: 0107" />
        </div>
        <div className="field field--grow">
          <label htmlFor="new-branch-name">Nome de exibição</label>
          <input
            id="new-branch-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="ex: Três-S"
          />
        </div>
        <div className="field field--grow">
          <label htmlFor="new-branch-group">Grupo corporativo</label>
          <select id="new-branch-group" value={groupKey} onChange={(e) => setGroupKey(e.target.value)}>
            <option value="">Sem grupo</option>
            {groups.map((group) => (
              <option key={group.groupKey} value={group.groupKey}>
                {group.displayName}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => void handleAdd()} disabled={saving}>
          <Plus size={14} /> {saving ? 'Adicionando...' : 'Adicionar'}
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>
          <X size={14} /> Cancelar
        </button>
      </div>
    </div>
  );
}
