import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

type TriageStep = 'legal' | 'work' | 'housing' | 'language' | 'interests' | 'urgencies';

const steps: TriageStep[] = ['legal', 'work', 'housing', 'language', 'interests', 'urgencies'];

export default function Triage() {
  const { t } = useLanguage();
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({
    legal: '',
    work: '',
    housing: '',
    language: '',
    interests: [],
    urgencies: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const stepConfig = {
    legal: {
      title: t.triage.legalStatus,
      options: [
        { value: 'regularized', label: 'Situação regularizada' },
        { value: 'pending', label: 'Em processo de regularização' },
        { value: 'not_regularized', label: 'Ainda não iniciou processo' },
        { value: 'refugee', label: 'Pedido de asilo/refugiado' },
      ],
    },
    work: {
      title: t.triage.workStatus,
      options: [
        { value: 'employed', label: 'Empregado(a)' },
        { value: 'unemployed_seeking', label: 'Desempregado(a), à procura' },
        { value: 'unemployed_not_seeking', label: 'Desempregado(a), não procura' },
        { value: 'student', label: 'Estudante' },
        { value: 'self_employed', label: 'Trabalhador(a) independente' },
      ],
    },
    housing: {
      title: t.triage.housingStatus,
      options: [
        { value: 'stable', label: 'Habitação estável' },
        { value: 'temporary', label: 'Habitação temporária' },
        { value: 'precarious', label: 'Situação precária' },
        { value: 'homeless', label: 'Sem abrigo' },
      ],
    },
    language: {
      title: t.triage.language,
      options: [
        { value: 'native', label: 'Nativo ou fluente' },
        { value: 'advanced', label: 'Avançado' },
        { value: 'intermediate', label: 'Intermédio' },
        { value: 'basic', label: 'Básico' },
        { value: 'none', label: 'Não fala português' },
      ],
    },
    interests: {
      title: t.triage.interests,
      multiple: true,
      options: [
        { value: 'tech', label: 'Tecnologia e Informática' },
        { value: 'construction', label: 'Construção Civil' },
        { value: 'hospitality', label: 'Hotelaria e Restauração' },
        { value: 'healthcare', label: 'Saúde e Cuidados' },
        { value: 'commerce', label: 'Comércio e Vendas' },
        { value: 'cleaning', label: 'Limpeza e Manutenção' },
        { value: 'agriculture', label: 'Agricultura' },
        { value: 'industry', label: 'Indústria' },
        { value: 'admin', label: 'Administrativo' },
        { value: 'entrepreneurship', label: 'Empreendedorismo' },
      ],
    },
    urgencies: {
      title: t.triage.urgencies,
      multiple: true,
      options: [
        { value: 'legal', label: 'Apoio jurídico/legal urgente' },
        { value: 'psychological', label: 'Apoio psicológico' },
        { value: 'housing', label: 'Necessidade de habitação' },
        { value: 'food', label: 'Necessidades alimentares' },
        { value: 'health', label: 'Cuidados de saúde' },
        { value: 'documents', label: 'Documentação' },
        { value: 'none', label: 'Nenhuma urgência' },
      ],
    },
  };

  const currentConfig = stepConfig[steps[currentStep]];
  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleSingleAnswer = (value: string) => {
    setAnswers({ ...answers, [steps[currentStep]]: value });
  };

  const handleMultipleAnswer = (value: string, checked: boolean) => {
    const current = answers[steps[currentStep]] as string[];
    const updated = checked
      ? [...current, value]
      : current.filter((v) => v !== value);
    setAnswers({ ...answers, [steps[currentStep]]: updated });
  };

  const canProceed = () => {
    const answer = answers[steps[currentStep]];
    if (Array.isArray(answer)) {
      return answer.length > 0;
    }
    return !!answer;
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Erro de autenticação');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // First check if triage exists
      const { data: existingTriage } = await supabase
        .from('triage')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingTriage) {
        // Update existing triage
        const { error } = await supabase
          .from('triage')
          .update({
            legal_status: answers.legal as string,
            work_status: answers.work as string,
            housing_status: answers.housing as string,
            language_level: answers.language as string,
            interests: answers.interests as string[],
            urgencies: answers.urgencies as string[],
            completed: true,
            completed_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        // Insert new triage
        const { error } = await supabase
          .from('triage')
          .insert({
            user_id: user.id,
            legal_status: answers.legal as string,
            work_status: answers.work as string,
            housing_status: answers.housing as string,
            language_level: answers.language as string,
            interests: answers.interests as string[],
            urgencies: answers.urgencies as string[],
            completed: true,
            completed_at: new Date().toISOString(),
          });
        if (error) throw error;
      }

      await refreshProfile();
      toast.success('Triagem completa! O seu perfil foi personalizado.');
      navigate('/dashboard/migrante');
    } catch (error: unknown) {
      console.error('Triage error:', error);
      toast.error('Erro ao guardar triagem. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout hideFooter>
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12">
        <div className="w-full max-w-2xl px-4">
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">{t.triage.title}</h1>
            <p className="text-muted-foreground">{t.triage.subtitle}</p>
          </div>

          <div className="mb-8">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>Passo {currentStep + 1} de {steps.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="cpc-card p-8">
            <h2 className="text-xl font-semibold mb-6">{currentConfig.title}</h2>

            {'multiple' in currentConfig && currentConfig.multiple ? (
              <div className="space-y-3">
                {currentConfig.options.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={(answers[steps[currentStep]] as string[]).includes(option.value)}
                      onCheckedChange={(checked) =>
                        handleMultipleAnswer(option.value, checked as boolean)
                      }
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
                <p className="text-sm text-muted-foreground mt-4">
                  Selecione todas as opções aplicáveis
                </p>
              </div>
            ) : (
              <RadioGroup
                value={answers[steps[currentStep]] as string}
                onValueChange={handleSingleAnswer}
                className="space-y-3"
              >
                {currentConfig.options.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors"
                  >
                    <RadioGroupItem value={option.value} />
                    <span>{option.label}</span>
                  </label>
                ))}
              </RadioGroup>
            )}

            <div className="flex justify-between mt-8">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 0}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t.common.back}
              </Button>
              <Button onClick={handleNext} disabled={!canProceed() || isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t.common.loading}
                  </>
                ) : currentStep === steps.length - 1 ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    {t.triage.submit}
                  </>
                ) : (
                  <>
                    {t.common.next}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
