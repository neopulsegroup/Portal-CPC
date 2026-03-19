import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { addDocument, getDocument, queryDocuments, setDocument, updateDocument } from '@/integrations/firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save } from 'lucide-react';

export default function CreateJobPage() {
  const { user, profile, profileData } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editJobId, setEditJobId] = useState<string | null>(null);
  const [existingStatus, setExistingStatus] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    sector: '',
    contract_type: 'full_time',
    salary_range: '',
    requirements: '',
  });

  useEffect(() => {
    setEditJobId(searchParams.get('edit'));
    fetchCompany();
  }, [user, searchParams]);

  useEffect(() => {
    if (!companyId || !editJobId) return;
    void fetchOfferForEdit({ companyId, jobId: editJobId });
  }, [companyId, editJobId]);

  async function fetchCompany() {
    if (!user) return;

    try {
      const data = await queryDocuments<{ id: string }>(
        'companies',
        [{ field: 'user_id', operator: '==', value: user.uid }],
        undefined,
        1
      );

      if (data[0]?.id) {
        setCompanyId(data[0].id);
        return;
      }

      const direct = await getDocument<{ id: string; user_id?: string }>('companies', user.uid);
      if (direct) {
        if (direct.user_id !== user.uid) await setDocument('companies', user.uid, { user_id: user.uid }, true);
        setCompanyId(direct.id);
        return;
      }

      if (profile?.role === 'company') {
        const baseName =
          (profileData?.name && profileData.name.trim() ? profileData.name.trim() : null) ??
          (profile?.name && profile.name.trim() ? profile.name.trim() : null) ??
          (user.displayName && user.displayName.trim() ? user.displayName.trim() : null) ??
          user.email ??
          'Empresa';

        await setDocument(
          'companies',
          user.uid,
          { user_id: user.uid, company_name: baseName, verified: false, createdAt: new Date().toISOString() },
          true
        );
        setCompanyId(user.uid);
      }
    } catch (error) {
      console.error('Error fetching company:', error);
    }
  }

  async function fetchOfferForEdit(args: { companyId: string; jobId: string }) {
    try {
      const offer = await getDocument<{
        id: string;
        company_id?: string;
        title?: string;
        description?: string | null;
        location?: string | null;
        sector?: string | null;
        contract_type?: string | null;
        salary_range?: string | null;
        requirements?: string | null;
        status?: string;
      }>('job_offers', args.jobId);

      if (!offer || offer.company_id !== args.companyId) {
        toast({
          title: t.get('company.createJob.errors.loadFailedTitle'),
          description: t.get('company.createJob.errors.loadFailedDesc'),
          variant: 'destructive',
        });
        navigate('/dashboard/empresa/ofertas');
        return;
      }

      setExistingStatus(offer.status ?? null);
      setForm({
        title: offer.title ?? '',
        description: offer.description ?? '',
        location: offer.location ?? '',
        sector: offer.sector ?? '',
        contract_type: offer.contract_type ?? 'full_time',
        salary_range: offer.salary_range ?? '',
        requirements: offer.requirements ?? '',
      });
    } catch (error) {
      console.error('Error loading offer for edit:', error);
      toast({
        title: t.get('company.createJob.errors.loadFailedTitle'),
        description: t.get('company.createJob.errors.loadFailedDesc'),
        variant: 'destructive',
      });
      navigate('/dashboard/empresa/ofertas');
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!companyId) {
      toast({
        title: t.get('company.createJob.errors.companyNotFoundTitle'),
        description: t.get('company.createJob.errors.companyNotFoundDesc'),
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      if (editJobId) {
        await updateDocument('job_offers', editJobId, {
          title: form.title,
          description: form.description || null,
          location: form.location || null,
          sector: form.sector || null,
          contract_type: form.contract_type || null,
          salary_range: form.salary_range || null,
          requirements: form.requirements || null,
          status: existingStatus ?? 'pending_review',
        });

        toast({
          title: t.get('company.createJob.toast.updatedTitle'),
          description: t.get('company.createJob.toast.updatedDesc'),
        });
      } else {
        await addDocument('job_offers', {
          company_id: companyId,
          title: form.title,
          description: form.description || null,
          location: form.location || null,
          sector: form.sector || null,
          contract_type: form.contract_type || null,
          salary_range: form.salary_range || null,
          requirements: form.requirements || null,
          status: 'pending_review',
          created_at: new Date().toISOString(),
        });

        toast({
          title: t.get('company.createJob.toast.createdTitle'),
          description: t.get('company.createJob.toast.createdDesc'),
        });
      }
      navigate('/dashboard/empresa/ofertas');
    } catch (error) {
      console.error('Error saving job:', error);
      toast({
        title: t.get('company.createJob.errors.createFailedTitle'),
        description: t.get('company.createJob.errors.createFailedDesc'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Link
        to="/dashboard/empresa"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        {t.get('company.createJob.backToDashboard')}
      </Link>

      <div className="max-w-2xl">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          {editJobId ? t.get('company.createJob.editTitle') : t.get('company.createJob.title')}
        </h1>
        <p className="text-muted-foreground mb-8">
          {editJobId ? t.get('company.createJob.editSubtitle') : t.get('company.createJob.subtitle')}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="cpc-card p-6 space-y-4">
            <h2 className="font-semibold">{t.get('company.createJob.form.sectionTitle')}</h2>

            <div>
              <label className="text-sm font-medium mb-2 block">{t.get('company.createJob.form.labels.title')}</label>
              <Input
                placeholder={t.get('company.createJob.form.placeholders.title')}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{t.get('company.createJob.form.labels.description')}</label>
              <Textarea
                placeholder={t.get('company.createJob.form.placeholders.description')}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">{t.get('company.createJob.form.labels.location')}</label>
                <Input
                  placeholder={t.get('company.createJob.form.placeholders.location')}
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">{t.get('company.createJob.form.labels.sector')}</label>
                <Input
                  placeholder={t.get('company.createJob.form.placeholders.sector')}
                  value={form.sector}
                  onChange={(e) => setForm({ ...form, sector: e.target.value })}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">{t.get('company.createJob.form.labels.contractType')}</label>
                <select
                  value={form.contract_type}
                  onChange={(e) => setForm({ ...form, contract_type: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-input bg-background"
                >
                  <option value="full_time">{t.get('company.createJob.form.contractTypes.full_time')}</option>
                  <option value="part_time">{t.get('company.createJob.form.contractTypes.part_time')}</option>
                  <option value="temporary">{t.get('company.createJob.form.contractTypes.temporary')}</option>
                  <option value="internship">{t.get('company.createJob.form.contractTypes.internship')}</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">{t.get('company.createJob.form.labels.salaryRange')}</label>
                <Input
                  placeholder={t.get('company.createJob.form.placeholders.salaryRange')}
                  value={form.salary_range}
                  onChange={(e) => setForm({ ...form, salary_range: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{t.get('company.createJob.form.labels.requirements')}</label>
              <Textarea
                placeholder={t.get('company.createJob.form.placeholders.requirements')}
                value={form.requirements}
                onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                rows={4}
              />
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/dashboard/empresa')}
            >
              {t.get('company.createJob.actions.cancel')}
            </Button>
            <Button type="submit" disabled={loading || !form.title}>
              {loading ? (
                t.get('company.createJob.actions.saving')
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {editJobId ? t.get('company.createJob.actions.save') : t.get('company.createJob.actions.publish')}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
