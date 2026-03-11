import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { getDocument, setDocument, updateDocument } from '@/integrations/firebase/firestore';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, Loader2, CheckCircle, ClipboardList, MapPin, Plane } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PhoneInput } from '@/components/ui/phone-input';


// --- Types ---

type TriageQuestionType = 'radio' | 'select' | 'multiselect' | 'text' | 'textarea' | 'date' | 'phone';

interface TriageQuestion {
  id: string;
  labelKey: string;
  type: TriageQuestionType;
  options?: string[];
  placeholderKey?: string;
  required?: boolean;
  dependsOn?: {
    field: string;
    value: string;
  };
}

interface TriageStep {
  id: string;
  titleKey: string;
  questions: TriageQuestion[];
}

type AnswerValue = string | string[] | boolean | null | undefined;
type TriageAnswers = Record<string, AnswerValue>;

// --- Countries List (Simplified) ---
const COUNTRIES = [
  'Portugal', 'Brasil', 'Angola', 'Moçambique', 'Cabo Verde', 
  'Guiné-Bissau', 'São Tomé e Príncipe', 'Timor-Leste', 
  'Ucrânia', 'Índia', 'Bangladesh', 'Nepal', 'Paquistão', 
  'Venezuela', 'Colômbia', 'Outro'
];

// --- Steps Configuration ---

const ALL_STEPS: TriageStep[] = [
  {
    id: 'personal_data',
    titleKey: 'triage.steps.personal_data',
    questions: [
      {
        id: 'birth_date',
        labelKey: 'triage.questions.birth_date',
        type: 'date',
        required: true
      },
      {
        id: 'gender',
        labelKey: 'triage.questions.gender',
        type: 'radio',
        options: ['male', 'female', 'other_prefer_not_say'],
        required: true
      },
      {
        id: 'nationality',
        labelKey: 'triage.questions.nationality',
        type: 'select',
        options: COUNTRIES,
        required: true
      },
      {
        id: 'origin_country',
        labelKey: 'triage.questions.origin_country',
        type: 'select',
        options: COUNTRIES,
        required: true
      },
      {
        id: 'languages',
        labelKey: 'triage.questions.languages',
        type: 'multiselect',
        options: ['portuguese', 'english', 'french', 'spanish', 'other'],
        required: true
      },
    ],
  },
  {
    id: 'contacts',
    titleKey: 'triage.steps.contacts',
    questions: [
      {
        id: 'phone',
        labelKey: 'triage.questions.phone',
        type: 'phone',
        required: true
      },
      {
        id: 'contact_preference',
        labelKey: 'triage.questions.contact_preference',
        type: 'radio',
        options: ['email', 'phone', 'whatsapp'],
        required: true
      },
    ],
  },
  {
    id: 'location',
    titleKey: 'triage.steps.location',
    questions: [
      {
        id: 'is_in_portugal',
        labelKey: 'triage.questions.is_in_portugal',
        type: 'radio',
        options: ['yes', 'no'],
        required: true
      },
    ],
  },
  // --- BRANCH: NOT IN PORTUGAL ---
  {
    id: 'pre_arrival_general',
    titleKey: 'triage.steps.pre_arrival_general',
    questions: [
      {
        id: 'current_country',
        labelKey: 'triage.questions.current_country',
        type: 'text',
        placeholderKey: 'triage.placeholders.current_country',
        dependsOn: { field: 'is_in_portugal', value: 'no' },
        required: true
      },
      {
        id: 'arrival_date',
        labelKey: 'triage.questions.arrival_date',
        type: 'radio',
        options: ['3_months', '6_months', '12_months', 'no_date'],
        dependsOn: { field: 'is_in_portugal', value: 'no' },
        required: true
      },
    ],
  },
  {
    id: 'pre_arrival_legal',
    titleKey: 'triage.steps.pre_arrival_legal',
    questions: [
      {
        id: 'visa_started',
        labelKey: 'triage.questions.visa_started',
        type: 'radio',
        options: ['yes', 'no', 'dont_know_how'],
        dependsOn: { field: 'is_in_portugal', value: 'no' },
        required: true
      },
      {
        id: 'visa_stage',
        labelKey: 'triage.questions.visa_stage',
        type: 'radio',
        options: ['gathering_docs', 'submitted', 'waiting', 'other'],
        dependsOn: { field: 'visa_started', value: 'yes' }
      },
    ],
  },
  {
    id: 'pre_arrival_cultural',
    titleKey: 'triage.steps.pre_arrival_cultural',
    questions: [
      {
        id: 'knowledge_level',
        labelKey: 'triage.questions.knowledge_level',
        type: 'radio',
        options: ['none', 'little', 'reasonable', 'good', 'very_good'],
        dependsOn: { field: 'is_in_portugal', value: 'no' },
        required: true
      },
      {
        id: 'cultural_program_interest',
        labelKey: 'triage.questions.cultural_program_interest',
        type: 'radio',
        options: ['yes', 'no', 'maybe'],
        dependsOn: { field: 'is_in_portugal', value: 'no' }
      },
      {
        id: 'portuguese_level',
        labelKey: 'triage.questions.portuguese_level',
        type: 'radio',
        options: ['none', 'basic', 'intermediate', 'advanced', 'fluent'],
        dependsOn: { field: 'is_in_portugal', value: 'no' },
        required: true
      },
      {
        id: 'portuguese_classes_interest',
        labelKey: 'triage.questions.portuguese_classes_interest',
        type: 'radio',
        options: ['yes', 'no'],
        dependsOn: { field: 'portuguese_level', value: 'fluent', }
      },
    ],
  },
  {
    id: 'pre_arrival_expectations',
    titleKey: 'triage.steps.pre_arrival_expectations',
    questions: [
      {
        id: 'motivation',
        labelKey: 'triage.questions.motivation',
        type: 'radio',
        options: ['work', 'study', 'family', 'security', 'other'],
        dependsOn: { field: 'is_in_portugal', value: 'no' },
        required: true
      },
      {
        id: 'doubts',
        labelKey: 'triage.questions.doubts',
        type: 'textarea',
        dependsOn: { field: 'is_in_portugal', value: 'no' }
      },
      {
        id: 'challenges',
        labelKey: 'triage.questions.challenges',
        type: 'multiselect',
        options: ['housing', 'job_search', 'culture', 'language', 'legal', 'other'],
        dependsOn: { field: 'is_in_portugal', value: 'no' }
      },
      {
        id: 'expectations_12_months',
        labelKey: 'triage.questions.expectations_12_months',
        type: 'textarea',
        dependsOn: { field: 'is_in_portugal', value: 'no' }
      },
      {
        id: 'life_in_3_years',
        labelKey: 'triage.questions.life_in_3_years',
        type: 'textarea',
        dependsOn: { field: 'is_in_portugal', value: 'no' }
      },
      {
        id: 'success_signs',
        labelKey: 'triage.questions.success_signs',
        type: 'text',
        dependsOn: { field: 'is_in_portugal', value: 'no' }
      },
      {
        id: 'why_portugal',
        labelKey: 'triage.questions.why_portugal',
        type: 'multiselect',
        options: ['work_conditions', 'security', 'reputation', 'migration_ease', 'other'],
        dependsOn: { field: 'is_in_portugal', value: 'no' }
      },
      {
        id: 'desired_support',
        labelKey: 'triage.questions.desired_support',
        type: 'multiselect',
        options: ['visa_info', 'cost_of_living', 'regions_info', 'job_support', 'housing_suggestions', 'emotional_support', 'cultural_training', 'language_training'],
        dependsOn: { field: 'is_in_portugal', value: 'no' }
      },
    ],
  },

  // --- BRANCH: IN PORTUGAL ---
  {
    id: 'post_arrival_integration',
    titleKey: 'triage.steps.post_arrival_integration',
    questions: [
      {
        id: 'arrival_date_pt',
        labelKey: 'triage.questions.arrival_date_pt',
        type: 'text',
        placeholderKey: 'triage.placeholders.arrival_date_pt',
        dependsOn: { field: 'is_in_portugal', value: 'yes' },
        required: true
      },
      {
        id: 'legal_status',
        labelKey: 'triage.questions.legal_status',
        type: 'radio',
        options: ['regularized', 'pending', 'not_regularized', 'refugee'],
        dependsOn: { field: 'is_in_portugal', value: 'yes' },
        required: true
      },
    ],
  },
  {
    id: 'post_arrival_autonomy',
    titleKey: 'triage.steps.post_arrival_autonomy',
    questions: [
      {
        id: 'daily_autonomy',
        labelKey: 'triage.questions.daily_autonomy',
        type: 'radio',
        options: ['1', '2', '3', '4', '5'],
        dependsOn: { field: 'is_in_portugal', value: 'yes' },
        required: true
      },
      {
        id: 'communication_comfort',
        labelKey: 'triage.questions.communication_comfort',
        type: 'radio',
        options: ['1', '2', '3', '4', '5'],
        dependsOn: { field: 'is_in_portugal', value: 'yes' },
        required: true
      },
      {
        id: 'social_norms',
        labelKey: 'triage.questions.social_norms',
        type: 'radio',
        options: ['1', '2', '3', '4', '5'],
        dependsOn: { field: 'is_in_portugal', value: 'yes' },
        required: true
      },
      {
        id: 'language_level',
        labelKey: 'triage.questions.language_level',
        type: 'radio',
        options: ['none', 'basic', 'intermediate', 'advanced', 'native'],
        dependsOn: { field: 'is_in_portugal', value: 'yes' },
        required: true
      },
    ],
  },
  {
    id: 'post_arrival_needs',
    titleKey: 'triage.steps.post_arrival_needs',
    questions: [
      {
        id: 'housing_status',
        labelKey: 'triage.questions.housing_status',
        type: 'radio',
        options: ['stable', 'temporary', 'precarious', 'homeless', 'searching'],
        dependsOn: { field: 'is_in_portugal', value: 'yes' },
        required: true
      },
      {
        id: 'basic_services',
        labelKey: 'triage.questions.basic_services',
        type: 'radio',
        options: ['yes', 'no_help', 'other'],
        dependsOn: { field: 'is_in_portugal', value: 'yes' },
        required: true
      },
      {
        id: 'bank_account',
        labelKey: 'triage.questions.bank_account',
        type: 'radio',
        options: ['yes', 'no', 'needs_help'],
        dependsOn: { field: 'is_in_portugal', value: 'yes' },
        required: true
      },
      {
        id: 'sns_registered',
        labelKey: 'triage.questions.sns_registered',
        type: 'radio',
        options: ['yes', 'no', 'dont_know_how'],
        dependsOn: { field: 'is_in_portugal', value: 'yes' },
        required: true
      },
      {
        id: 'identified_needs',
        labelKey: 'triage.questions.identified_needs',
        type: 'multiselect',
        options: ['housing', 'food', 'health', 'employment', 'legal_info', 'psychological', 'other'],
        dependsOn: { field: 'is_in_portugal', value: 'yes' }
      },
    ],
  },
  {
    id: 'psychological_support',
    titleKey: 'triage.steps.psychological_support',
    questions: [
      {
        id: 'emotional_wellbeing',
        labelKey: 'triage.questions.emotional_wellbeing',
        type: 'radio',
        options: ['1', '2', '3', '4', '5'],
        dependsOn: { field: 'is_in_portugal', value: 'yes' }
      },
      {
        id: 'wants_psych_support',
        labelKey: 'triage.questions.wants_psych_support',
        type: 'radio',
        options: ['yes', 'no', 'maybe'],
        dependsOn: { field: 'is_in_portugal', value: 'yes' }
      },
    ]
  },

  // --- COMMON PROFESSIONAL SECTION ---
  {
    id: 'professional_profile',
    titleKey: 'triage.steps.professional_profile',
    questions: [
      {
        id: 'education_level',
        labelKey: 'triage.questions.education_level',
        type: 'radio',
        options: ['basic', 'secondary', 'technical', 'bachelor', 'master', 'phd', 'other'],
        required: true
      },
      {
        id: 'education_validation_interest',
        labelKey: 'triage.questions.education_validation_interest',
        type: 'radio',
        options: ['yes', 'no'],
        dependsOn: { field: 'is_in_portugal', value: 'no' },
        required: true
      },
      {
        id: 'professional_interests',
        labelKey: 'triage.questions.professional_interests',
        type: 'multiselect',
        options: ['tourism', 'catering', 'construction', 'agriculture', 'technology', 'social_services', 'education', 'health', 'cleaning', 'logistics', 'transport', 'beauty', 'other'],
        required: true
      },
      {
        id: 'professional_experience',
        labelKey: 'triage.questions.professional_experience',
        type: 'textarea',
        dependsOn: { field: 'is_in_portugal', value: 'no' }
      },
      {
        id: 'work_status',
        labelKey: 'triage.questions.work_status',
        type: 'radio',
        options: ['employed', 'unemployed_seeking', 'student', 'other'],
        dependsOn: { field: 'is_in_portugal', value: 'yes' },
        required: true
      },
    ],
  },
];

export default function Triage() {
  const { t } = useLanguage();
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<TriageAnswers>({});
  const [saving, setSaving] = useState(false);

  const currentStep = ALL_STEPS[step];

  const getVisibleQuestions = (currentStep: TriageStep, currentAnswers: TriageAnswers) => {
    return currentStep.questions.filter(q => !q.dependsOn || currentAnswers[q.dependsOn.field] === q.dependsOn.value);
  };

  const getNextStepIndex = (currentIndex: number, currentAnswers: TriageAnswers) => {
    let nextIndex = currentIndex + 1;
    while (nextIndex < ALL_STEPS.length) {
      if (getVisibleQuestions(ALL_STEPS[nextIndex], currentAnswers).length > 0) {
        return nextIndex;
      }
      nextIndex++;
    }
    return -1; // End of triage
  };

  const getPrevStepIndex = (currentIndex: number, currentAnswers: TriageAnswers) => {
    let prevIndex = currentIndex - 1;
    while (prevIndex >= 0) {
      if (getVisibleQuestions(ALL_STEPS[prevIndex], currentAnswers).length > 0) {
        return prevIndex;
      }
      prevIndex--;
    }
    return -1;
  };

  const handleNext = () => {
    const nextIndex = getNextStepIndex(step, answers);
    if (nextIndex !== -1) {
      setStep(nextIndex);
    } else {
      // Logic to handle save if it's the last practical step
      // The button currently calls saveTriage directly if step === ALL_STEPS.length - 1
      // We need to adjust the render logic for the button or handle it here
    }
  };

  const handleBack = () => {
    const prevIndex = getPrevStepIndex(step, answers);
    if (prevIndex !== -1) {
      setStep(prevIndex);
    }
  };

  const progress = ((step + 1) / ALL_STEPS.length) * 100;

  const updateAnswer = (questionId: string, value: AnswerValue) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const canProceed = () => {
    if (!currentStep) return false;

    const visibleQuestions = getVisibleQuestions(currentStep, answers);

    for (const q of visibleQuestions) {
      if (q.required) {
        const val = answers[q.id];
        if (val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) {
          return false;
        }
      }
    }
    return true;
  };

  async function saveTriage() {
    if (!user) {
      toast.error('Você precisa estar logado para salvar a triagem.');
      navigate('/entrar');
      return;
    }
    setSaving(true);
    try {
      console.log('[Triage] Starting save process...');

      const baseData: Record<string, unknown> = {
        userId: user.uid,
        completed: true,
        completedAt: new Date().toISOString(),
        answers: answers
      };

      // Map answers to database columns where possible
      if (answers.is_in_portugal === 'yes') {
        baseData.legal_status = ['regularized', 'pending', 'not_regularized', 'refugee'].includes(answers.legal_status) ? answers.legal_status : null;
        baseData.language_level = ['native', 'advanced', 'intermediate', 'basic', 'none'].includes(answers.language_level) ? answers.language_level : null;
        baseData.housing_status = ['stable', 'temporary', 'precarious', 'homeless'].includes(answers.housing_status) ? answers.housing_status : null;
        baseData.work_status = ['employed', 'unemployed_seeking', 'student', 'other'].includes(answers.work_status) ? answers.work_status : null;
        baseData.urgencies = answers.identified_needs || [];
      } else {
        baseData.urgencies = answers.desired_support || [];
        if (typeof answers.portuguese_level === 'string') {
          const mapLang: Record<string, string> = { 'fluent': 'native', 'none': 'none', 'basic': 'basic', 'intermediate': 'intermediate', 'advanced': 'advanced' };
          baseData.language_level = mapLang[answers.portuguese_level];
        }
      }
      baseData.interests = answers.professional_interests || [];

      console.log('[Triage] Checking for existing triage record...');
      const existing = await getDocument('triage', user.uid);

      if (existing) {
        console.log('[Triage] Updating existing record...');
        await updateDocument('triage', user.uid, baseData);
      } else {
        console.log('[Triage] Inserting new record...');
        await setDocument('triage', user.uid, baseData);
      }

      console.log('[Triage] Saved successfully');

      console.log('[Triage] Refreshing profile...');
      await refreshProfile();
      console.log('[Triage] Profile refreshed successfully');

      toast.success(t.triage.success);
      console.log('[Triage] Navigating to dashboard...');
      navigate('/dashboard/migrante');
    } catch (err: unknown) {
      console.error('[Triage] Final triage save error:', err);
      toast.error('Erro ao salvar triagem. Tente novamente.');
    } finally {
      setSaving(false);
      console.log('[Triage] Save process completed');
    }
  };


  if (!currentStep) return <div className="p-8 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>;

  return (
    <Layout hideFooter>
      <div className="min-h-[calc(100vh-4rem)] bg-background py-8">
        <div className="container max-w-2xl mx-auto px-4">

          <div className="mb-8 space-y-2">
            <h1 className="text-2xl font-bold">{t.triage.title}</h1>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{t.triage.step_count.replace('{current}', (step + 1).toString()).replace('{total}', ALL_STEPS.length.toString())}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-8">
            <h2 className="text-xl font-semibold">{t.get(currentStep.titleKey)}</h2>

            <div className="space-y-6">
              {getVisibleQuestions(currentStep, answers).map(question => (
                <div key={question.id} className="space-y-3">
                  <label className="text-sm font-medium block">
                    {t.get(question.labelKey)} {question.required && <span className="text-destructive">*</span>}
                  </label>

                  {question.type === 'text' && (
                    <Input
                      placeholder={question.placeholderKey ? t.get(question.placeholderKey) : ''}
                      value={answers[question.id] || ''}
                      onChange={(e) => updateAnswer(question.id, e.target.value)}
                    />
                  )}

                  {question.type === 'phone' && (
                    <PhoneInput
                      placeholder={question.placeholderKey ? t.get(question.placeholderKey) : '912 345 678'}
                      value={answers[question.id] || ''}
                      onChange={(val) => updateAnswer(question.id, val)}
                    />
                  )}

                  {question.type === 'date' && (
                    <Input
                      type="date"
                      value={answers[question.id] || ''}
                      onChange={(e) => updateAnswer(question.id, e.target.value)}
                    />
                  )}

                  {question.type === 'textarea' && (
                    <Textarea
                      placeholder={question.placeholderKey ? t.get(question.placeholderKey) : ''}
                      rows={4}
                      value={answers[question.id] || ''}
                      onChange={(e) => updateAnswer(question.id, e.target.value)}
                    />
                  )}

                  {question.type === 'radio' && question.id === 'is_in_portugal' && question.options && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {question.options.map(opt => {
                        const isSelected = answers[question.id] === opt;
                        return (
                          <div 
                            key={opt}
                            className={`
                              relative flex flex-col items-start p-6 rounded-xl border-2 cursor-pointer transition-all
                              ${isSelected 
                                ? 'border-primary bg-primary/5' 
                                : 'border-muted hover:border-primary/50 bg-card'}
                            `}
                            onClick={() => updateAnswer(question.id, opt)}
                          >
                            <div className={`
                              p-3 rounded-lg mb-4
                              ${isSelected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}
                            `}>
                              {opt === 'yes' ? <MapPin className="h-6 w-6" /> : <Plane className="h-6 w-6" />}
                            </div>
                            
                            <h3 className="font-semibold text-lg mb-1">
                              {t.get(`triage.options.is_in_portugal.${opt}`)}
                            </h3>
                            
                            <p className="text-sm text-muted-foreground">
                              {t.get(`triage.options.is_in_portugal_desc.${opt}`)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {question.type === 'radio' && question.id !== 'is_in_portugal' && question.options && (
                    <RadioGroup
                      value={answers[question.id]}
                      onValueChange={(val) => updateAnswer(question.id, val)}
                      className="space-y-2"
                    >
                      {question.options.map(opt => (
                        <div key={opt} className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-accent/50 cursor-pointer">
                          <RadioGroupItem value={opt} id={`${question.id}-${opt}`} />
                          <label htmlFor={`${question.id}-${opt}`} className="flex-1 cursor-pointer text-sm">
                            {t.get(`triage.options.${question.id}.${opt}`)}
                          </label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}

                  {question.type === 'select' && question.options && (
                    <Select
                      value={answers[question.id] || ''}
                      onValueChange={(v) => updateAnswer(question.id, v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t.triage.select_placeholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {question.options.map(opt => (
                          <SelectItem key={opt} value={opt}>
                            {(question.id === 'nationality' || question.id === 'origin_country')
                              ? opt
                              : t.get(`triage.options.${question.id}.${opt}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {question.type === 'multiselect' && question.options && (
                    <div className="flex flex-wrap gap-2">
                      {question.options.map(opt => {
                        const currentArr = (answers[question.id] || []) as string[];
                        const isSelected = currentArr.includes(opt);
                        return (
                          <button
                            key={opt}
                            onClick={() => {
                              if (isSelected) {
                                updateAnswer(question.id, currentArr.filter(i => i !== opt));
                              } else {
                                updateAnswer(question.id, [...currentArr, opt]);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${isSelected
                              ? 'bg-primary/10 text-primary border-primary/50'
                              : 'bg-background hover:bg-muted'
                              }`}
                          >
                            {t.get(`triage.options.${question.id}.${opt}`)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={handleBack} disabled={step === 0}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t.triage.back}
              </Button>
              {getNextStepIndex(step, answers) === -1 ? (
                <Button
                  onClick={saveTriage}
                  disabled={!canProceed() || saving}
                  className="gap-2"
                >
                  {saving ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  {t.triage.confirm}
                </Button>
              ) : (
                <Button onClick={handleNext} disabled={!canProceed()}>
                  {t.triage.next}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
}
