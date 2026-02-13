import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, Loader2, CheckCircle, ClipboardList } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';


// --- Types ---

type TriageQuestionType = 'radio' | 'select' | 'multiselect' | 'text' | 'textarea';

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

// --- Steps Configuration ---

const ALL_STEPS: TriageStep[] = [
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
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const currentStep = ALL_STEPS[step];

  const getVisibleQuestions = (currentStep: TriageStep, currentAnswers: Record<string, any>) => {
    return currentStep.questions.filter(q => !q.dependsOn || currentAnswers[q.dependsOn.field] === q.dependsOn.value);
  };

  const getNextStepIndex = (currentIndex: number, currentAnswers: Record<string, any>) => {
    let nextIndex = currentIndex + 1;
    while (nextIndex < ALL_STEPS.length) {
      if (getVisibleQuestions(ALL_STEPS[nextIndex], currentAnswers).length > 0) {
        return nextIndex;
      }
      nextIndex++;
    }
    return -1; // End of triage
  };

  const getPrevStepIndex = (currentIndex: number, currentAnswers: Record<string, any>) => {
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

  const updateAnswer = (questionId: string, value: any) => {
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
    if (!user) return;
    setSaving(true);
    try {
      const baseData: any = {
        user_id: user.id,
        completed: true,
        completed_at: new Date().toISOString(),
      };

      // Map answers to database columns where possible
      if (answers.is_in_portugal === 'yes') {
        baseData.legal_status = ['regularized', 'pending', 'not_regularized', 'refugee'].includes(answers.legal_status) ? answers.legal_status : null;
        baseData.language_level = ['native', 'advanced', 'intermediate', 'basic', 'none'].includes(answers.language_level) ? answers.language_level : null;
        baseData.housing_status = ['stable', 'temporary', 'precarious', 'homeless'].includes(answers.housing_status) ? answers.housing_status : null;
<<<<<<< HEAD
        baseData.work_status = ['employed', 'unemployed_seeking', 'student'].includes(answers.work_status) ? answers.work_status : null;
=======
        baseData.work_status = ['employed', 'unemployed_seeking', 'student', 'other'].includes(answers.work_status) ? answers.work_status : null;
>>>>>>> 351b2651eac9566321ff5dbe0b8a97e288420ce0
        baseData.urgencies = answers.identified_needs || [];
      } else {
        baseData.urgencies = answers.desired_support || [];
        if (answers.portuguese_level) {
          const mapLang: any = { 'fluent': 'native', 'none': 'none', 'basic': 'basic', 'intermediate': 'intermediate', 'advanced': 'advanced' };
          baseData.language_level = mapLang[answers.portuguese_level];
        }
      }
      baseData.interests = answers.professional_interests || [];
<<<<<<< HEAD
      // education_level removed as column does not exist in DB yet. Stored in answers JSON.


      console.log('Starting saveTriage...');

      // Check existing
      console.log('Checking existing triage...');
=======
      baseData.education_level = answers.education_level || null;


      // Check existing
>>>>>>> 351b2651eac9566321ff5dbe0b8a97e288420ce0
      const { data: existing } = await supabase.from('triage').select('id').eq('user_id', user.id).maybeSingle();

      let error;
      if (existing) {
<<<<<<< HEAD
        console.log('Updating existing triage...');
        const { error: updateError } = await supabase.from('triage').update({ ...baseData, answers: answers }).eq('user_id', user.id);
        error = updateError;
      } else {
        console.log('Inserting new triage...');
=======
        const { error: updateError } = await supabase.from('triage').update({ ...baseData, answers: answers }).eq('user_id', user.id);
        error = updateError;
      } else {
>>>>>>> 351b2651eac9566321ff5dbe0b8a97e288420ce0
        const { error: insertError } = await supabase.from('triage').insert({ ...baseData, answers: answers });
        error = insertError;
      }

      if (error) {
        console.warn('Erro ao guardar triage com answers, tentando sem a coluna:', error);
        // If 'answers' column causes an error (e.g., schema mismatch or type issue), try saving without it.
        // This assumes 'answers' is a JSONB column and might be problematic if not configured correctly or if the payload is too large.
        if (existing) {
<<<<<<< HEAD
          console.log('Retry update without answers...');
          const { error: updateError2 } = await supabase.from('triage').update(baseData).eq('user_id', user.id);
          if (updateError2) throw updateError2;
        } else {
          console.log('Retry insert without answers...');
=======
          const { error: updateError2 } = await supabase.from('triage').update(baseData).eq('user_id', user.id);
          if (updateError2) throw updateError2;
        } else {
>>>>>>> 351b2651eac9566321ff5dbe0b8a97e288420ce0
          const { error: insertError2 } = await supabase.from('triage').insert(baseData);
          if (insertError2) throw insertError2;
        }
      }

<<<<<<< HEAD
      console.log('Triage saved successfully. Refreshing profile...');
      await refreshProfile();
      console.log('Profile refreshed. Navigating...');

=======
      await refreshProfile();
>>>>>>> 351b2651eac9566321ff5dbe0b8a97e288420ce0
      toast.success(t.triage.success);
      navigate('/dashboard/migrante');
    } catch (err: any) {
      console.error('Final triage save error:', err);
      toast.error(t.triage.error);
    } finally {
      setSaving(false);
    }
  };

<<<<<<< HEAD
  if (!currentStep) return <div className="p-8 text-center flex flex-col items-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /><p>Carregando Triagem...</p></div>;
=======
  if (!currentStep) return <div className="p-8 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>;
>>>>>>> 351b2651eac9566321ff5dbe0b8a97e288420ce0

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

                  {question.type === 'textarea' && (
                    <Textarea
                      placeholder={question.placeholderKey ? t.get(question.placeholderKey) : ''}
                      rows={4}
                      value={answers[question.id] || ''}
                      onChange={(e) => updateAnswer(question.id, e.target.value)}
                    />
                  )}

                  {question.type === 'radio' && question.options && (
                    <RadioGroup
<<<<<<< HEAD
                      value={answers[question.id] || ""}
=======
                      value={answers[question.id]}
>>>>>>> 351b2651eac9566321ff5dbe0b8a97e288420ce0
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
                          <SelectItem key={opt} value={opt}>{t.get(`triage.options.${question.id}.${opt}`)}</SelectItem>
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
