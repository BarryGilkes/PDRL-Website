import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Zap, Shield, Heart, Users } from 'lucide-react';

export default function About() {
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
              <Zap size={14} className="text-neon-cyan" />
              <span className="text-sm text-neon-cyan font-semibold">About PDRL</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-heading font-black text-white mb-4 tracking-tight">
              ABOUT <span className="text-neon-cyan">PDRL</span>
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl">
              Building a professional, organized, and fair drag racing community.
            </p>
          </motion.div>

          <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="font-heading font-bold text-white tracking-wide">Our Mission</CardTitle>
                </CardHeader>
                <CardContent className="text-gray-400 space-y-4 leading-relaxed">
                  <p>
                    The Pro Drag Racing League (PDRL) was founded to create a structured, professional platform
                    for drag racing enthusiasts of all skill levels. We believe in fair competition, clear rules,
                    and putting safety first.
                  </p>
                  <p>
                    Our goal is to provide a well-organized racing series that's accessible to street car owners
                    while also offering a competitive environment for pro-level builds. With four distinct classes
                    and a single-elimination bracket format, every racer knows exactly what to expect.
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="font-heading font-bold text-white tracking-wide">What We Offer</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {[
                      { title: 'Clear Class Structure', desc: 'Four well-defined classes from True Street to Pro' },
                      { title: 'Professional Timing', desc: 'Accurate timing equipment for all runs' },
                      { title: 'Safety First', desc: 'Comprehensive tech inspection and safety requirements' },
                      { title: 'Fair Competition', desc: 'Heads-up racing with single elimination brackets' },
                      { title: 'Community', desc: 'A welcoming environment for racers and fans' },
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-gray-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan mt-2 flex-shrink-0" />
                        <span><strong className="text-white">{item.title}:</strong> {item.desc}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="font-heading font-bold text-white tracking-wide">Our Values</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-6">
                    {[
                      { icon: Shield, title: 'Safety', desc: 'Every racer goes home safe. We enforce strict safety standards and conduct thorough tech inspections.', color: 'neon-cyan' },
                      { icon: Heart, title: 'Fairness', desc: 'Clear rules, consistent enforcement, and equal opportunity for all competitors to succeed.', color: 'neon-red' },
                      { icon: Users, title: 'Community', desc: 'Building lasting relationships between racers, crews, and fans who share a passion for drag racing.', color: 'neon-orange' },
                    ].map((val, i) => (
                      <div key={i} className="text-center">
                        <div className={`w-12 h-12 rounded-xl bg-${val.color}/10 flex items-center justify-center mx-auto mb-3`}>
                          <val.icon size={24} className={`text-${val.color}`} />
                        </div>
                        <h3 className={`font-heading font-bold text-${val.color} mb-2`}>{val.title}</h3>
                        <p className="text-sm text-gray-400">{val.desc}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="font-heading font-bold text-white tracking-wide">Sponsors & Partners</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400 mb-6">
                    PDRL is proud to partner with leading automotive businesses and sponsors who support our mission.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="aspect-video bg-white/[0.03] border border-white/5 rounded-xl flex items-center justify-center p-4 hover:border-neon-cyan/20 transition-all duration-300">
                      <img src="/sponsors/dcr-motorsport.png" alt="DCR Motorsport" className="max-w-full max-h-full object-contain" />
                    </div>
                    <div className="aspect-video bg-white/[0.03] border border-white/5 rounded-xl flex items-center justify-center p-4 hover:border-neon-cyan/20 transition-all duration-300">
                      <img src="/sponsors/max-torque-performance.jpg" alt="Max Torque Performance" className="max-w-full max-h-full object-contain" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}