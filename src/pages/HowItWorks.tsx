import { Layout } from '@/components/layout/Layout';
import { useLanguage } from '@/contexts/LanguageContext';
import { BookOpen, Users, Briefcase, ArrowRight, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function HowItWorks() {
  const { t } = useLanguage();

  const steps = [
    {
      number: '01',
      icon: BookOpen,
      title: t.howItWorks.steps.step1.title,
      description: t.howItWorks.steps.step1.description,
      details: [
        'Módulos sobre cultura portuguesa',
        'Direitos e deveres laborais',
        'Sistema de saúde',
        'Documentação e legalização',
      ],
      color: 'bg-blue-500',
    },
    {
      number: '02',
      icon: Users,
      title: t.howItWorks.steps.step2.title,
      description: t.howItWorks.steps.step2.description,
      details: [
        'Mediação cultural',
        'Apoio jurídico',
        'Acompanhamento psicológico',
        'Gestão de caso individual',
      ],
      color: 'bg-green-500',
    },
    {
      number: '03',
      icon: Briefcase,
      title: t.howItWorks.steps.step3.title,
      description: t.howItWorks.steps.step3.description,
      details: [
        'Criação de CV profissional',
        'Preparação para entrevistas',
        'Conexão com empresas',
        'Acompanhamento pós-colocação',
      ],
      color: 'bg-purple-500',
    },
  ];

  return (
    <Layout>
      {/* Hero */}
      <section className="cpc-gradient-bg text-primary-foreground py-20">
        <div className="cpc-container text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t.howItWorks.title}</h1>
          <p className="text-xl opacity-90">{t.howItWorks.subtitle}</p>
        </div>
      </section>

      {/* Steps */}
      <section className="cpc-section">
        <div className="cpc-container">
          <div className="max-w-4xl mx-auto">
            {steps.map((step, index) => (
              <div key={step.number} className="relative">
                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className="absolute left-8 top-24 bottom-0 w-0.5 bg-border hidden md:block" />
                )}

                <div className="flex flex-col md:flex-row gap-6 mb-12">
                  {/* Number Circle */}
                  <div className="flex-shrink-0">
                    <div className={`w-16 h-16 rounded-2xl ${step.color} text-white flex items-center justify-center font-bold text-xl shadow-lg`}>
                      {step.number}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 cpc-card p-6 md:p-8">
                    <div className="flex items-center gap-3 mb-4">
                      <step.icon className="h-6 w-6 text-primary" />
                      <h3 className="text-xl font-bold">{step.title}</h3>
                    </div>
                    <p className="text-muted-foreground mb-6">{step.description}</p>

                    <ul className="grid sm:grid-cols-2 gap-3">
                      {step.details.map((detail) => (
                        <li key={detail} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cpc-section bg-muted/30">
        <div className="cpc-container text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            {t.howItWorks.ctaTitle}
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            {t.howItWorks.ctaSubtitle}
          </p>
          <Button size="lg" asChild>
            <Link to="/registar">
              {t.nav.register}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
