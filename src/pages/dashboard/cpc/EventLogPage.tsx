import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { queryDocuments } from '@/integrations/firebase/firestore';
import { createdAtToIso } from '@/lib/firestoreTimestamps';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollText, Search } from 'lucide-react';

type AuditLogRow = {
  id: string;
  action?: string | null;
  actor_id?: string | null;
  context?: string | null;
  target_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  createdAt?: unknown;
};

type EventLogEntry = {
  id: string;
  action: string;
  actorId: string;
  context: string;
  targetId: string;
  createdAtIso: string;
  createdAtMs: number;
};

const LOG_FETCH_LIMIT = 400;

function isCpcAdminRole(role?: string | null): boolean {
  return String(role ?? '').toLowerCase() === 'admin';
}

export default function EventLogPage() {
  const { user, profile } = useAuth();
  const { t, language } = useLanguage();
  const isAdmin = isCpcAdminRole(profile?.role);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rows, setRows] = useState<EventLogEntry[]>([]);
  const [search, setSearch] = useState('');

  const fetchLogs = useCallback(async () => {
    if (!isAdmin) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const docs = await queryDocuments<AuditLogRow>('audit_logs', [], undefined, LOG_FETCH_LIMIT);
      const mapped: EventLogEntry[] = docs.map((doc) => {
        const createdAtIso = createdAtToIso(doc.createdAt) || '';
        const createdAtMs = createdAtIso ? new Date(createdAtIso).getTime() : 0;
        return {
          id: doc.id,
          action: typeof doc.action === 'string' ? doc.action : '—',
          actorId: typeof doc.actor_id === 'string' ? doc.actor_id : '—',
          context: typeof doc.context === 'string' ? doc.context : '—',
          targetId:
            (typeof doc.target_id === 'string' && doc.target_id) ||
            (typeof doc.entity_id === 'string' && doc.entity_id) ||
            '—',
          createdAtIso,
          createdAtMs: Number.isNaN(createdAtMs) ? 0 : createdAtMs,
        };
      });
      mapped.sort((a, b) => b.createdAtMs - a.createdAtMs);
      setRows(mapped);
    } catch (error) {
      console.error('Error loading audit logs:', error);
      setRows([]);
      setLoadError(t.get('cpc.pages.eventLog.loadError'));
    } finally {
      setLoading(false);
    }
  }, [isAdmin, t]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const haystack = [row.action, row.actorId, row.context, row.targetId].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, search]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(language === 'pt' ? 'pt-PT' : language === 'es' ? 'es-ES' : language === 'fr' ? 'fr-FR' : 'en-GB', {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
    [language]
  );

  if (!user || !profile) {
    return (
      <div className="space-y-6">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <ScrollText className="h-7 w-7 text-primary shrink-0" aria-hidden />
            {t.get('cpc.pages.eventLog.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t.get('cpc.pages.eventLog.loginRequired')}</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <ScrollText className="h-7 w-7 text-primary shrink-0" aria-hidden />
            {t.get('cpc.pages.eventLog.title')}
          </h1>
          <p className="text-destructive mt-1">{t.get('cpc.pages.eventLog.noPermission')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <ScrollText className="h-7 w-7 text-primary shrink-0" aria-hidden />
            {t.get('cpc.pages.eventLog.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t.get('cpc.pages.eventLog.subtitle')}</p>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{loadError}</div>
      ) : null}

      <div className="cpc-card p-4">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.get('cpc.pages.eventLog.searchPlaceholder')}
            className="pl-10"
            aria-label={t.get('cpc.pages.eventLog.searchPlaceholder')}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-3">
          {t.get('cpc.pages.eventLog.count', { count: filteredRows.length })}
        </p>
      </div>

      <div className="cpc-card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">{t.get('cpc.pages.eventLog.empty')}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.get('cpc.pages.eventLog.columns.date')}</TableHead>
                <TableHead>{t.get('cpc.pages.eventLog.columns.action')}</TableHead>
                <TableHead>{t.get('cpc.pages.eventLog.columns.actor')}</TableHead>
                <TableHead>{t.get('cpc.pages.eventLog.columns.context')}</TableHead>
                <TableHead>{t.get('cpc.pages.eventLog.columns.target')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {row.createdAtIso ? dateFormatter.format(new Date(row.createdAtIso)) : '—'}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.action}</TableCell>
                  <TableCell className="font-mono text-xs max-w-[180px] truncate" title={row.actorId}>
                    {row.actorId}
                  </TableCell>
                  <TableCell className="text-sm">{row.context}</TableCell>
                  <TableCell className="font-mono text-xs max-w-[180px] truncate" title={row.targetId}>
                    {row.targetId}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
