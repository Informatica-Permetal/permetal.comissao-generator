import { useEffect, useState } from 'react';
import type { CompanyProfileWithLogoPreview } from '@shared/types/companyProfile';

export default function CompanyProfilesSection() {
  const [profiles, setProfiles] = useState<CompanyProfileWithLogoPreview[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    if (updated) await refresh();
  }

  async function handleFieldSave(
    branchCode: string,
    field: 'displayName' | 'legalName' | 'tradeName' | 'cnpj' | 'endereco' | 'cidade' | 'uf',
    value: string
  ): Promise<void> {
    const profile = profiles?.find((p) => p.branchCode === branchCode);
    if (!profile) return;

    const nextAddress = {
      endereco: profile.address?.endereco ?? '',
      cidade: profile.address?.cidade ?? '',
      uf: profile.address?.uf ?? ''
    };
    if (field === 'endereco' || field === 'cidade' || field === 'uf') {
      nextAddress[field] = value;
    }

    await window.api.companies.upsert({
      branchCode,
      displayName: field === 'displayName' ? value : profile.displayName,
      legalName: field === 'legalName' ? value || null : profile.legalName,
      tradeName: field === 'tradeName' ? value || null : profile.tradeName,
      cnpj: field === 'cnpj' ? value || null : profile.cnpj,
      address: nextAddress,
      active: profile.active
    });
    await refresh();
  }

  if (error) return <p className="company-profiles__error">{error}</p>;
  if (!profiles) return <p>Carregando filiais...</p>;

  return (
    <div className="company-profiles">
      {profiles.map((profile) => (
        <article key={profile.branchCode} className="company-profiles__card">
          <header className="company-profiles__header">
            {profile.logoDataUri ? (
              <img className="company-profiles__logo" src={profile.logoDataUri} alt={profile.displayName} />
            ) : (
              <div className="company-profiles__logo company-profiles__logo--empty">sem logo</div>
            )}
            <div>
              <strong>{profile.branchCode}</strong>
              <button type="button" onClick={() => void handleChooseLogo(profile.branchCode)}>
                Escolher logo
              </button>
            </div>
          </header>
          <div className="company-profiles__fields">
            <label>
              Nome
              <input
                defaultValue={profile.displayName}
                onBlur={(e) => void handleFieldSave(profile.branchCode, 'displayName', e.target.value)}
              />
            </label>
            <label>
              Razao social
              <input
                defaultValue={profile.legalName ?? ''}
                onBlur={(e) => void handleFieldSave(profile.branchCode, 'legalName', e.target.value)}
              />
            </label>
            <label>
              Nome fantasia
              <input
                defaultValue={profile.tradeName ?? ''}
                onBlur={(e) => void handleFieldSave(profile.branchCode, 'tradeName', e.target.value)}
              />
            </label>
            <label>
              CNPJ
              <input
                defaultValue={profile.cnpj ?? ''}
                onBlur={(e) => void handleFieldSave(profile.branchCode, 'cnpj', e.target.value)}
              />
            </label>
            <label>
              Endereco
              <input
                defaultValue={profile.address?.endereco ?? ''}
                onBlur={(e) => void handleFieldSave(profile.branchCode, 'endereco', e.target.value)}
              />
            </label>
            <label>
              Cidade
              <input
                defaultValue={profile.address?.cidade ?? ''}
                onBlur={(e) => void handleFieldSave(profile.branchCode, 'cidade', e.target.value)}
              />
            </label>
            <label>
              UF
              <input
                defaultValue={profile.address?.uf ?? ''}
                maxLength={2}
                onBlur={(e) => void handleFieldSave(profile.branchCode, 'uf', e.target.value)}
              />
            </label>
          </div>
        </article>
      ))}
    </div>
  );
}
