import { useEffect, useState } from 'react';
import { ImageUp, Plus, Save, Building2, X } from 'lucide-react';
import type { CompanyProfileWithLogoPreview } from '@shared/types/companyProfile';
import { useToast } from './ToastProvider';

interface FieldsState {
  displayName: string;
  legalName: string;
  tradeName: string;
  cnpj: string;
  endereco: string;
  cidade: string;
  uf: string;
}

function toFields(profile: CompanyProfileWithLogoPreview): FieldsState {
  return {
    displayName: profile.displayName,
    legalName: profile.legalName ?? '',
    tradeName: profile.tradeName ?? '',
    cnpj: profile.cnpj ?? '',
    endereco: profile.address?.endereco ?? '',
    cidade: profile.address?.cidade ?? '',
    uf: profile.address?.uf ?? ''
  };
}

export default function CompanyProfilesSection() {
  const [profiles, setProfiles] = useState<CompanyProfileWithLogoPreview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh(): Promise<void> {
    try {
      const list = await window.api.companies.list();
      setProfiles(list);
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

  async function handleSave(branchCode: string, active: boolean, fields: FieldsState): Promise<void> {
    try {
      await window.api.companies.upsert({
        branchCode,
        displayName: fields.displayName,
        legalName: fields.legalName || null,
        tradeName: fields.tradeName || null,
        cnpj: fields.cnpj || null,
        address: { endereco: fields.endereco, cidade: fields.cidade, uf: fields.uf },
        active
      });
      await refresh();
      showToast('success', `Filial ${branchCode} atualizada.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Falha ao salvar a filial.');
    }
  }

  async function handleAddBranch(branchCode: string, displayName: string): Promise<void> {
    await window.api.companies.upsert({ branchCode, displayName, active: true });
    await refresh();
    setShowAddForm(false);
    showToast('success', `Filial ${branchCode} adicionada.`);
  }

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
      {profiles.map((profile) => (
        <CompanyCard
          key={profile.branchCode}
          profile={profile}
          onChooseLogo={() => void handleChooseLogo(profile.branchCode)}
          onSave={(fields) => handleSave(profile.branchCode, profile.active, fields)}
        />
      ))}

      {showAddForm ? (
        <AddBranchCard onCancel={() => setShowAddForm(false)} onAdd={handleAddBranch} />
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
  onSave
}: {
  profile: CompanyProfileWithLogoPreview;
  onChooseLogo: () => void;
  onSave: (fields: FieldsState) => Promise<void>;
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
    <article className="company-card card">
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
          <div className="company-card__group-title">Identificacao</div>
          <div className="company-card__fields">
            <div className="field">
              <label htmlFor={`${id}-displayName`}>Nome de exibicao</label>
              <input
                id={`${id}-displayName`}
                value={fields.displayName}
                onChange={(e) => update('displayName', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor={`${id}-legalName`}>Razao social</label>
              <input
                id={`${id}-legalName`}
                value={fields.legalName}
                onChange={(e) => update('legalName', e.target.value)}
                placeholder="Nao informado"
              />
            </div>
            <div className="field">
              <label htmlFor={`${id}-tradeName`}>Nome fantasia</label>
              <input
                id={`${id}-tradeName`}
                value={fields.tradeName}
                onChange={(e) => update('tradeName', e.target.value)}
                placeholder="Nao informado"
              />
            </div>
            <div className="field">
              <label htmlFor={`${id}-cnpj`}>CNPJ</label>
              <input
                id={`${id}-cnpj`}
                value={fields.cnpj}
                onChange={(e) => update('cnpj', e.target.value)}
                placeholder="Nao informado"
              />
            </div>
          </div>
        </div>

        <div className="company-card__group">
          <div className="company-card__group-title">Endereco</div>
          <div className="company-card__fields company-card__fields--address">
            <div className="field">
              <label htmlFor={`${id}-endereco`}>Endereco</label>
              <input
                id={`${id}-endereco`}
                value={fields.endereco}
                onChange={(e) => update('endereco', e.target.value)}
                placeholder="Nao informado"
              />
            </div>
            <div className="field">
              <label htmlFor={`${id}-cidade`}>Cidade</label>
              <input
                id={`${id}-cidade`}
                value={fields.cidade}
                onChange={(e) => update('cidade', e.target.value)}
                placeholder="Nao informado"
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
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn--primary btn--sm" onClick={() => void handleSaveClick()} disabled={saving}>
          <Save size={14} /> {saving ? 'Salvando...' : 'Salvar alteracoes'}
        </button>
      </div>
    </article>
  );
}

function AddBranchCard({
  onCancel,
  onAdd
}: {
  onCancel: () => void;
  onAdd: (branchCode: string, displayName: string) => Promise<void>;
}) {
  const [branchCode, setBranchCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function handleAdd(): Promise<void> {
    if (!branchCode.trim() || !displayName.trim()) {
      showToast('error', 'Informe o codigo e o nome da filial.');
      return;
    }
    setSaving(true);
    try {
      await onAdd(branchCode.trim(), displayName.trim());
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
          <label htmlFor="new-branch-code">Codigo da filial</label>
          <input id="new-branch-code" value={branchCode} onChange={(e) => setBranchCode(e.target.value)} placeholder="ex: 0107" />
        </div>
        <div className="field field--grow">
          <label htmlFor="new-branch-name">Nome de exibicao</label>
          <input
            id="new-branch-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="ex: Tres-S"
          />
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
