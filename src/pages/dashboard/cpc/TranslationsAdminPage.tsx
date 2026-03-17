import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getCollection, getDocument, setDocument, updateDocument } from '@/integrations/firebase/firestore';
import { flattenTranslationStringKeys, getTranslationStringAtPath, Language, translations } from '@/lib/i18n';
import { toast } from 'sonner';

type I18nSettingsDoc = { id: string; enabled?: boolean; version?: number };
type I18nOverrideDoc = { id: string; pt?: string; en?: string; es?: string; updatedAt?: unknown };

type DraftRow = { pt: string; en: string; es: string };

const ALLOWED_ROLES = new Set(['admin', 'manager', 'coordinator']);

function normalizeKeyQuery(value: string): string {
  return value.trim().toLowerCase();
}

function getDisplayValue(args: {
  keyPath: string;
  lang: Language;
  draft: Record<string, DraftRow>;
  overrides: Map<string, I18nOverrideDoc>;
}): string {
  const { keyPath, lang, draft, overrides } = args;
  const draftValue = draft[keyPath]?.[lang];
  if (typeof draftValue === 'string') return draftValue;

  const override = overrides.get(keyPath);
  const overrideValue = override?.[lang];
  if (typeof overrideValue === 'string' && overrideValue.trim()) return overrideValue;

  return getTranslationStringAtPath(lang, keyPath) ?? '';
}

function buildMissingReport(keys: string[]) {
  const out: Record<Language, string[]> = { pt: [], en: [], es: [] };
  for (const key of keys) {
    (['pt', 'en', 'es'] as const).forEach((lang) => {
      const value = getTranslationStringAtPath(lang, key);
      if (!value || !value.trim()) out[lang].push(key);
    });
  }
  return out;
}

export default function TranslationsAdminPage() {
  const { profile } = useAuth();
  const { t } = useLanguage();

  const canManage = ALLOWED_ROLES.has(String(profile?.role ?? '').toLowerCase());

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<{ enabled: boolean; version: number }>({ enabled: true, version: 0 });
  const [overrides, setOverrides] = useState<Map<string, I18nOverrideDoc>>(() => new Map());
  const [draft, setDraft] = useState<Record<string, DraftRow>>({});
  const [query, setQuery] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const [missing, setMissing] = useState<Record<Language, string[]>>({ pt: [], en: [], es: [] });

  const baseKeys = useMemo(() => flattenTranslationStringKeys(translations.pt), []);

  const filteredKeys = useMemo(() => {
    const q = normalizeKeyQuery(query);
    if (!q) return baseKeys;
    return baseKeys.filter((k) => k.toLowerCase().includes(q));
  }, [baseKeys, query]);

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const doc = await getDocument<I18nSettingsDoc>('i18n', 'settings');
        const enabled = doc?.enabled !== false;
        const version = typeof doc?.version === 'number' ? doc.version : 0;
        if (!cancelled) setSettings({ enabled, version });

        const docs = await getCollection<I18nOverrideDoc>('i18n_overrides');
        const map = new Map<string, I18nOverrideDoc>();
        for (const d of docs) map.set(d.id, d);
        if (!cancelled) setOverrides(map);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [canManage]);

  function updateDraft(keyPath: string, lang: Language, value: string) {
    setDraft((prev) => {
      const current = prev[keyPath] ?? {
        pt: getDisplayValue({ keyPath, lang: 'pt', draft: prev, overrides }),
        en: getDisplayValue({ keyPath, lang: 'en', draft: prev, overrides }),
        es: getDisplayValue({ keyPath, lang: 'es', draft: prev, overrides }),
      };
      return { ...prev, [keyPath]: { ...current, [lang]: value } };
    });
  }

  function validateDraftCompleteness() {
    const incomplete: string[] = [];
    for (const [key, row] of Object.entries(draft)) {
      if (!row.pt.trim() || !row.en.trim() || !row.es.trim()) incomplete.push(key);
    }
    return incomplete;
  }

  async function handleValidate() {
    setValidating(true);
    try {
      const report = buildMissingReport(baseKeys);
      setMissing(report);
      setValidationOpen(true);
    } finally {
      setValidating(false);
    }
  }

  async function handlePublish() {
    const incomplete = validateDraftCompleteness();
    if (incomplete.length > 0) {
      toast.error(t.get('cpcTranslations.validation.incomplete_draft', { count: incomplete.length }));
      return;
    }

    const entries = Object.entries(draft);
    if (entries.length === 0) {
      toast.message(t.get('cpcTranslations.publish.nothing_to_publish'));
      return;
    }

    try {
      for (const [keyPath, row] of entries) {
        await setDocument('i18n_overrides', keyPath, { pt: row.pt, en: row.en, es: row.es }, true);
      }

      const nextVersion = (settings.version ?? 0) + 1;
      if (settings.version === 0) {
        await setDocument('i18n', 'settings', { enabled: true, version: nextVersion }, true);
      } else {
        await updateDocument('i18n', 'settings', { enabled: settings.enabled, version: nextVersion });
      }

      setSettings((s) => ({ ...s, version: nextVersion }));
      setDraft({});
      toast.success(t.get('cpcTranslations.publish.success', { version: nextVersion }));

      const docs = await getCollection<I18nOverrideDoc>('i18n_overrides');
      const map = new Map<string, I18nOverrideDoc>();
      for (const d of docs) map.set(d.id, d);
      setOverrides(map);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t.get('common.error');
      toast.error(message);
    }
  }

  function handleToggleEnabled(next: boolean) {
    setSettings((s) => ({ ...s, enabled: next }));
    void updateDocument('i18n', 'settings', { enabled: next, version: settings.version }).catch(() => {
      toast.error(t.get('common.error'));
    });
  }

  if (!canManage) {
    return (
      <div className="cpc-card p-6">
        <h1 className="text-xl font-semibold">{t.get('cpcTranslations.title')}</h1>
        <p className="text-sm text-muted-foreground mt-2">{t.get('cpcTranslations.no_permission')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="cpc-card p-6">
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  const draftCount = Object.keys(draft).length;

  return (
    <div className="space-y-6">
      <div className="cpc-card p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">{t.get('cpcTranslations.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t.get('cpcTranslations.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={handleValidate} disabled={validating}>
              {t.get('cpcTranslations.actions.validate')}
            </Button>
            <Button onClick={handlePublish}>
              {t.get('cpcTranslations.actions.publish', { count: draftCount })}
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mt-6">
          <div className="space-y-2">
            <Label htmlFor="query">{t.get('cpcTranslations.search.label')}</Label>
            <Input id="query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.get('cpcTranslations.search.placeholder')} />
          </div>
          <div className="space-y-2">
            <Label>{t.get('cpcTranslations.settings.enabled')}</Label>
            <div className="flex items-center gap-3">
              <Button variant={settings.enabled ? 'default' : 'outline'} onClick={() => handleToggleEnabled(true)}>
                {t.common.yes}
              </Button>
              <Button variant={!settings.enabled ? 'default' : 'outline'} onClick={() => handleToggleEnabled(false)}>
                {t.common.no}
              </Button>
              <span className="text-sm text-muted-foreground">{t.get('cpcTranslations.settings.version', { version: settings.version })}</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t.get('cpcTranslations.runtimeMissing.title')}</Label>
            <Button
              variant="outline"
              onClick={() => {
                try {
                  localStorage.removeItem('cpc-i18n-missing');
                  toast.success(t.get('cpcTranslations.runtimeMissing.cleared'));
                } catch {
                  toast.error(t.common.error);
                }
              }}
            >
              {t.get('cpcTranslations.runtimeMissing.clear')}
            </Button>
          </div>
        </div>
      </div>

      <div className="cpc-card p-0 overflow-hidden">
        <div className="grid grid-cols-[minmax(220px,1.1fr)_minmax(220px,1fr)_minmax(220px,1fr)_minmax(220px,1fr)] gap-px bg-border">
          <div className="bg-background p-3 text-xs font-semibold text-muted-foreground">{t.get('cpcTranslations.table.key')}</div>
          <div className="bg-background p-3 text-xs font-semibold text-muted-foreground">PT</div>
          <div className="bg-background p-3 text-xs font-semibold text-muted-foreground">EN</div>
          <div className="bg-background p-3 text-xs font-semibold text-muted-foreground">ES</div>

          {filteredKeys.map((keyPath) => (
            <div key={keyPath} className="contents">
              <div className="bg-background p-3 text-xs text-muted-foreground break-all">{keyPath}</div>
              <div className="bg-background p-2">
                <Input
                  value={getDisplayValue({ keyPath, lang: 'pt', draft, overrides })}
                  onChange={(e) => updateDraft(keyPath, 'pt', e.target.value)}
                />
              </div>
              <div className="bg-background p-2">
                <Input
                  value={getDisplayValue({ keyPath, lang: 'en', draft, overrides })}
                  onChange={(e) => updateDraft(keyPath, 'en', e.target.value)}
                />
              </div>
              <div className="bg-background p-2">
                <Input
                  value={getDisplayValue({ keyPath, lang: 'es', draft, overrides })}
                  onChange={(e) => updateDraft(keyPath, 'es', e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={validationOpen} onOpenChange={setValidationOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.get('cpcTranslations.validation.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs font-semibold text-muted-foreground">PT</p>
                <p className="text-lg font-bold mt-1">{missing.pt.length}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs font-semibold text-muted-foreground">EN</p>
                <p className="text-lg font-bold mt-1">{missing.en.length}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs font-semibold text-muted-foreground">ES</p>
                <p className="text-lg font-bold mt-1">{missing.es.length}</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">{t.get('cpcTranslations.validation.hint')}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

