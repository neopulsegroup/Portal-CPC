import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Mail, Phone, MapPin, Clock, Send, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function Contact() {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate submission
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIsSubmitting(false);
    setSubmitted(true);
    toast.success(t.contact.form.success);
  };

  const contactInfo = [
    { icon: Mail, label: t.contact.info.email, value: 'info@cpc-portugal.org' },
    { icon: Phone, label: t.contact.info.phone, value: '+351 210 000 000' },
    { icon: MapPin, label: t.contact.info.address, value: 'Rua Principal 123, Lisboa' },
    { icon: Clock, label: t.contact.info.hours, value: 'Seg-Sex: 9h-18h' },
  ];

  const faqs = t.contact.faqs;

  return (
    <Layout>
      {/* Hero */}
      <section className="cpc-gradient-bg text-primary-foreground py-20">
        <div className="cpc-container text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t.contact.title}</h1>
          <p className="text-xl opacity-90">{t.contact.subtitle}</p>
        </div>
      </section>

      {/* Contact Form & Info */}
      <section className="cpc-section">
        <div className="cpc-container">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Form */}
            <div className="cpc-card p-8">
              {submitted ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{t.contact.form.sent}</h3>
                  <p className="text-muted-foreground">
                    {t.contact.form.sentSubtitle}
                  </p>
                  <Button className="mt-6" onClick={() => setSubmitted(false)}>
                    {t.contact.form.sendAnother}
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t.contact.form.name}</Label>
                    <Input id="name" required placeholder={t.contact.form.placeholderName} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">{t.contact.form.email}</Label>
                    <Input id="email" type="email" required placeholder={t.contact.form.placeholderEmail} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">{t.contact.form.message}</Label>
                    <Textarea
                      id="message"
                      required
                      rows={5}
                      placeholder={t.contact.form.placeholderMessage}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      t.common.loading
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        {t.contact.form.submit}
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>

            {/* Info */}
            <div>
              <div className="space-y-6 mb-12">
                {contactInfo.map((item) => (
                  <div key={item.label} className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-muted-foreground">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Map placeholder */}
              <div className="cpc-card h-48 flex items-center justify-center bg-muted/50">
                <p className="text-muted-foreground">Mapa</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="cpc-section bg-muted/30">
        <div className="cpc-container">
          <h2 className="text-2xl font-bold text-center mb-8">{t.contact.faqTitle}</h2>
          <div className="max-w-2xl mx-auto space-y-4">
            {faqs.map((faq) => (
              <div key={faq.q} className="cpc-card p-6">
                <h4 className="font-semibold mb-2">{faq.q}</h4>
                <p className="text-muted-foreground text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
