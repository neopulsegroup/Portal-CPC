import { Layout } from '@/components/layout/Layout';
import { useLanguage } from '@/contexts/LanguageContext';
import { Target, Heart, Users, Globe } from 'lucide-react';

export default function About() {
  const { t } = useLanguage();

  const values = [
    { icon: Heart, title: 'Inclusão', description: 'Acreditamos que todos merecem oportunidades iguais.' },
    { icon: Users, title: 'Dignidade', description: 'Tratamos cada pessoa com respeito e consideração.' },
    { icon: Target, title: 'Cooperação', description: 'Trabalhamos juntos para alcançar objetivos comuns.' },
    { icon: Globe, title: 'Sustentabilidade', description: 'Construímos soluções duradouras e impactantes.' },
  ];

  return (
    <Layout>
      {/* Hero */}
      <section className="cpc-gradient-bg text-primary-foreground py-20">
        <div className="cpc-container text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t.about.title}</h1>
          <p className="text-xl opacity-90">{t.about.subtitle}</p>
        </div>
      </section>

      {/* Mission */}
      <section className="cpc-section">
        <div className="cpc-container">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">{t.about.mission}</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t.about.missionText}
              </p>
            </div>

            <div className="cpc-card p-8 bg-accent/30 border-none">
              <p className="text-lg text-center italic text-muted-foreground">
                "{t.about.missionQuote}"
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="cpc-section bg-muted/30">
        <div className="cpc-container">
          <h2 className="text-3xl font-bold text-center mb-12">{t.about.values}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value) => (
              <div key={value.title} className="cpc-card p-6 text-center">
                <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                  <value.icon className="h-7 w-7" />
                </div>
                <h3 className="font-semibold mb-2">{value.title}</h3>
                <p className="text-sm text-muted-foreground">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Areas */}
      <section className="cpc-section">
        <div className="cpc-container">
          <h2 className="text-3xl font-bold text-center mb-12">{t.about.areas}</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="cpc-card p-6">
              <h3 className="text-xl font-semibold mb-3 text-primary">Lisboa e Vale do Tejo</h3>
              <p className="text-muted-foreground">
                Região metropolitana de Lisboa, incluindo concelhos limítrofes.
              </p>
            </div>
            <div className="cpc-card p-6">
              <h3 className="text-xl font-semibold mb-3 text-primary">Norte</h3>
              <p className="text-muted-foreground">
                Porto, Braga e região do Minho.
              </p>
            </div>
            <div className="cpc-card p-6">
              <h3 className="text-xl font-semibold mb-3 text-primary">Centro</h3>
              <p className="text-muted-foreground">
                Coimbra, Aveiro e região Centro.
              </p>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
