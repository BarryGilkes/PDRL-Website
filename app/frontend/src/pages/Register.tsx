import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@metagptx/web-sdk';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Zap, UserPlus } from 'lucide-react';
import { fetchPublicEvents } from '@/lib/publicApi';

const client = createClient();
const TURNSTILE_SITE_KEY = '0x4AAAAAACoNl5dBWvhIZ9Gu';

export default function Register() {
  const [user, setUser] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [previousRegs, setPreviousRegs] = useState<any[]>([]);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  // Load Turnstile script and render widget
  useEffect(() => {
    const renderWidget = () => {
      if (turnstileRef.current && (window as any).turnstile && !turnstileWidgetId.current) {
        turnstileWidgetId.current = (window as any).turnstile.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => setTurnstileToken(token),
          'expired-callback': () => setTurnstileToken(''),
          theme: 'dark',
        });
      }
    };

    if ((window as any).turnstile) {
      renderWidget();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => setTimeout(renderWidget, 100);
    document.head.appendChild(script);

    return () => {
      if (turnstileWidgetId.current && (window as any).turnstile) {
        (window as any).turnstile.remove(turnstileWidgetId.current);
        turnstileWidgetId.current = null;
      }
    };
  }, []);
  const [formData, setFormData] = useState({
    event_id: '',
    driver_name: '',
    phone: '',
    email: '',
    class_name: '',
    car: '',
    notes: '',
  });

  useEffect(() => {
    const init = async () => {
      try {
        const userRes = await client.auth.me();
        setUser(userRes.data);

        // Load previous registrations for autofill
        try {
          const regsRes = await client.apiCall.invoke({
            url: '/api/v1/registrations',
            method: 'GET',
            data: { limit: 10 },
          });
          const items = regsRes.data?.items || [];
          setPreviousRegs(items);
          if (items.length > 0) {
            const latest = items[0];
            setFormData((prev) => ({
              ...prev,
              driver_name: latest.driver_name || '',
              phone: latest.phone || '',
              email: latest.email || '',
              car: latest.car || '',
              class_name: latest.class_name || '',
            }));
          }
        } catch (err) {
          console.error('Failed to load previous registrations:', err);
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        setUser(null);
      }

      try {
        const items = await fetchPublicEvents({ limit: 50 });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcoming = items.filter((e: any) => {
          const d = new Date(e.date);
          d.setHours(0, 0, 0, 0);
          return e.status === 'upcoming' && d >= today;
        });
        setEvents(upcoming);
        if (upcoming.length > 0) {
          setFormData((prev) => ({ ...prev, event_id: upcoming[0].id.toString() }));
        }
      } catch (err) {
        console.error('Failed to load events:', err);
      }
    };
    init();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('Please login to register');
      client.auth.toLogin();
      return;
    }

    if (!formData.event_id) {
      toast.error('Please select an event');
      return;
    }

    if (!turnstileToken) {
      toast.error('Please complete the security check');
      return;
    }

    try {
      await client.apiCall.invoke({
        url: '/api/v1/registrations',
        method: 'POST',
        data: {
          event_id: parseInt(formData.event_id),
          driver_name: formData.driver_name,
          competition_number: '',
          phone: formData.phone,
          class_name: formData.class_name,
          car: formData.car,
          notes: formData.notes || '',
          payment_status: 'pending',
          submitted_at: new Date().toISOString(),
          turnstile_token: turnstileToken,
        },
      });

      toast.success('Registration submitted successfully!');
      setFormData((prev) => ({ ...prev, notes: '' }));
      // Reset turnstile for next submission
      setTurnstileToken('');
      if (turnstileWidgetId.current && (window as any).turnstile) {
        (window as any).turnstile.reset(turnstileWidgetId.current);
      }
    } catch (error: any) {
      toast.error(error?.data?.detail || 'Failed to submit registration');
      // Reset turnstile on error
      if (turnstileWidgetId.current && (window as any).turnstile) {
        (window as any).turnstile.reset(turnstileWidgetId.current);
      }
      setTurnstileToken('');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-dark-900 text-white">
      <Header />

      <main className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="inline-flex items-center gap-2 bg-neon-cyan/10 border border-neon-cyan/20 rounded-full px-4 py-2 mb-4">
              <UserPlus size={14} className="text-neon-cyan" />
              <span className="text-sm text-neon-cyan font-semibold">Registration</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-heading font-black text-white mb-4 tracking-tight">
              RACE <span className="text-neon-cyan">REGISTRATION</span>
            </h1>
            <p className="text-lg text-gray-400">
              Fill out the form below to register for an upcoming PDRL event.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="glass-card border-neon-cyan/10">
              <CardHeader>
                <CardTitle className="font-heading font-bold text-white tracking-wide flex items-center gap-2">
                  <Zap size={20} className="text-neon-cyan" />
                  Registration Form
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <Label className="text-gray-300 font-semibold">Event *</Label>
                    <Select value={formData.event_id} onValueChange={(value) => setFormData({ ...formData, event_id: value })}>
                      <SelectTrigger className="bg-dark-900/50 border-white/10 text-white focus:ring-neon-cyan/50 focus:border-neon-cyan/30 mt-1.5">
                        <SelectValue placeholder="Select an event..." />
                      </SelectTrigger>
                      <SelectContent className="bg-dark-500 border-white/10">
                        {events.map((evt) => (
                          <SelectItem key={evt.id} value={evt.id.toString()}>
                            {evt.title} — {evt.date}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-300 font-semibold">Driver Name *</Label>
                      <Input
                        required
                        value={formData.driver_name}
                        onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                        placeholder="Full name"
                        className="bg-dark-900/50 border-white/10 text-white focus:ring-neon-cyan/50 focus:border-neon-cyan/30 mt-1.5"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 font-semibold">Phone *</Label>
                      <Input
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+1 (246) 000-0000"
                        className="bg-dark-900/50 border-white/10 text-white focus:ring-neon-cyan/50 focus:border-neon-cyan/30 mt-1.5"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-gray-300 font-semibold">Email *</Label>
                    <Input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="you@example.com"
                      className="bg-dark-900/50 border-white/10 text-white focus:ring-neon-cyan/50 focus:border-neon-cyan/30 mt-1.5"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-300 font-semibold">Class *</Label>
                      <Select value={formData.class_name} onValueChange={(value) => setFormData({ ...formData, class_name: value })}>
                        <SelectTrigger className="bg-dark-900/50 border-white/10 text-white focus:ring-neon-cyan/50 focus:border-neon-cyan/30 mt-1.5">
                          <SelectValue placeholder="Select class..." />
                        </SelectTrigger>
                        <SelectContent className="bg-dark-500 border-white/10">
                          <SelectItem value="True Street">True Street</SelectItem>
                          <SelectItem value="Street Mod">Street Mod</SelectItem>
                          <SelectItem value="Pro Street">Pro Street</SelectItem>
                          <SelectItem value="Pro">Pro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-gray-300 font-semibold">Car *</Label>
                      <Input
                        required
                        value={formData.car}
                        onChange={(e) => setFormData({ ...formData, car: e.target.value })}
                        placeholder="Year / Make / Model"
                        className="bg-dark-900/50 border-white/10 text-white focus:ring-neon-cyan/50 focus:border-neon-cyan/30 mt-1.5"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-gray-300 font-semibold">Notes (optional)</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Any additional information..."
                      className="bg-dark-900/50 border-white/10 text-white focus:ring-neon-cyan/50 focus:border-neon-cyan/30 mt-1.5"
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-center">
                    <div ref={turnstileRef} />
                  </div>

                  <Button
                    type="submit"
                    disabled={!turnstileToken}
                    className="w-full bg-gradient-to-r from-neon-cyan to-cyan-600 text-dark-900 font-extrabold text-base py-6 rounded-xl hover:shadow-[0_0_25px_rgba(0,212,255,0.4)] transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    <Zap size={18} className="mr-2" />
                    Submit Registration
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}