import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Mail, Phone, MapPin, Clock, Send, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { addDocument, getDocument, serverTimestamp } from '@/integrations/firebase/firestore';
import { buildContactNotificationMail, isValidEmail, normalizeEmail } from '@/pages/dashboard/cpc/settingsUtils';

export default function Contact() {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', message: '' });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const name = form.name.trim();
      const email = form.email.trim();
      const message = form.message.trim();

      if (!name) throw new Error('Indique o seu nome.');
      if (!isValidEmail(email)) throw new Error('Indique um email válido.');
      if (!message) throw new Error('Escreva a sua mensagem.');
      if (message.length > 5000) throw new Error('A mensagem é demasiado longa.');

      const settings = await getDocument<{ id: string; notificationEmail?: string | null }>('system_settings', 'contact');
      const notificationEmail = typeof settings?.notificationEmail === 'string' ? settings.notificationEmail : '';
      if (!isValidEmail(notificationEmail)) throw new Error('O sistema de contacto não está configurado.');

      const createdAtISO = new Date().toISOString();
      await addDocument('contact_messages', {
        name,
        email: normalizeEmail(email),
        message,
        createdAt: serverTimestamp(),
        source: '/contacto',
      });

      const mail = buildContactNotificationMail({
        to: notificationEmail,
        replyTo: email,
        name,
        email,
        message,
        createdAtISO,
      });
      await addDocument('mail', { ...mail, createdAt: serverTimestamp(), tag: 'contact' });

      setSubmitted(true);
      toast.success(t.contact.form.success);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactInfo = [
    { icon: Mail, label: t.contact.info.email, value: 'geral@cibea.eu' },
    { icon: Phone, label: t.contact.info.phone, value: '+351 225 088 015' },
    { icon: MapPin, label: t.contact.info.address, value: 'Algarve (Portugal)' },
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
                    <Input
                      id="name"
                      required
                      placeholder={t.contact.form.placeholderName}
                      value={form.name}
                      onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">{t.contact.form.email}</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      placeholder={t.contact.form.placeholderEmail}
                      value={form.email}
                      onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">{t.contact.form.message}</Label>
                    <Textarea
                      id="message"
                      required
                      rows={5}
                      placeholder={t.contact.form.placeholderMessage}
                      value={form.message}
                      onChange={(e) => setForm((s) => ({ ...s, message: e.target.value }))}
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
              <div className="cpc-card h-64 overflow-hidden">
                <iframe 
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d407307.7290886638!2d-8.799797307525287!3d37.16147690227546!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd0554f676239169%3A0x446e05d045d625e1!2sAlgarve!5e0!3m2!1spt-PT!2spt!4v1710332800000!5m2!1spt-PT!2spt"
                  width="100%" 
                  height="100%" 
                  style={{ border: 0 }} 
                  allowFullScreen 
                  loading="lazy" 
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Mapa do Algarve"
                />
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
