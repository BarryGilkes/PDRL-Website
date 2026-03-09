import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Phone, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Contact() {
  return (
    <div className="min-h-screen flex flex-col bg-dark-900 text-white">
      <Header />

      <main className="flex-1 py-12">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="inline-flex items-center gap-2 bg-neon-cyan/10 border border-neon-cyan/20 rounded-full px-4 py-2 mb-4">
              <Mail size={14} className="text-neon-cyan" />
              <span className="text-sm text-neon-cyan font-semibold">Contact</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-heading font-black text-white mb-4 tracking-tight">
              GET IN <span className="text-neon-cyan">TOUCH</span>
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl">
              Have questions? Want to sponsor or partner with PDRL? We'd love to hear from you.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {[
              { icon: Mail, title: 'Email', value: 'dcrmotorsport@gmail.com', href: 'mailto:dcrmotorsport@gmail.com', desc: 'For general inquiries, sponsorship, and partnership opportunities' },
              { icon: MessageCircle, title: 'WhatsApp', value: '+1 (246) 834-0025', href: 'https://wa.me/12468340025', desc: 'Quick questions and registration support' },
              { icon: Phone, title: 'Phone', value: '+1 (246) 834-0025', href: 'tel:+12468340025', desc: 'Call during business hours' },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="glass-card-hover h-full">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 rounded-xl bg-neon-cyan/10 flex items-center justify-center">
                        <item.icon size={24} className="text-neon-cyan" />
                      </div>
                      <CardTitle className="font-heading font-bold text-white tracking-wide">{item.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <a href={item.href} target={item.href.startsWith('http') ? '_blank' : undefined} rel="noopener" className="text-neon-cyan hover:underline font-semibold">
                      {item.value}
                    </a>
                    <p className="text-sm text-gray-500 mt-2">{item.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: 'For Racers',
                items: ['Registration assistance', 'Class eligibility questions', 'Tech inspection requirements', 'Event information'],
              },
              {
                title: 'For Sponsors & Partners',
                items: ['Event sponsorship', 'Series partnership', 'Product placement', 'Media opportunities'],
              },
            ].map((section, i) => (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
              >
                <Card className="glass-card h-full">
                  <CardHeader>
                    <CardTitle className="font-heading font-bold text-white tracking-wide">{section.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-400 mb-4">
                      {i === 0
                        ? 'Questions about registration, rules, or class requirements? Contact us via WhatsApp or email and we\'ll get back to you quickly.'
                        : 'Interested in sponsoring PDRL or partnering with us? We offer various sponsorship packages and partnership opportunities.'}
                    </p>
                    <ul className="space-y-2">
                      {section.items.map((item, j) => (
                        <li key={j} className="flex items-start gap-2.5 text-gray-400 text-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan mt-1.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}