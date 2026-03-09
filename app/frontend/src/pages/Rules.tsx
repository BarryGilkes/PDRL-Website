import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Shield, AlertTriangle, Car, Flag, FileText } from 'lucide-react';

export default function Rules() {
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
              <Shield size={14} className="text-neon-cyan" />
              <span className="text-sm text-neon-cyan font-semibold">Rules & Safety</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-heading font-black text-white mb-4 tracking-tight">
              RULES & <span className="text-neon-cyan">SAFETY</span>
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl">
              Safety is our top priority. All racers must comply with these rules and requirements.
            </p>
          </motion.div>

          <div className="space-y-6">
            {[
              {
                icon: Shield,
                title: 'Safety Requirements',
                color: 'neon-cyan',
                items: [
                  'All drivers must wear a helmet (Snell SA2015 or newer)',
                  'Fire-resistant suit required for 10-second and faster cars',
                  'SFI-rated harness required for all classes',
                  'Roll cage required for 10-second and faster cars (NHRA spec)',
                  'Fire suppression system required for Pro Street and Pro classes',
                  'Parachute required for cars running 8.50 or faster',
                  'Long pants and closed-toe shoes required at all times on track',
                ],
              },
              {
                icon: Flag,
                title: 'Competition Rules',
                color: 'neon-red',
                items: [
                  'Heads-up racing format with single elimination brackets',
                  'Pro Tree (.400) start for all classes',
                  'Breakout rule applies — you must not run faster than your class limit',
                  'Red light (foul start) results in automatic disqualification',
                  'Lane choice goes to the driver with the better qualifying time',
                  'All disputes will be settled by PDRL officials — their decision is final',
                  'Unsportsmanlike conduct will result in disqualification',
                ],
              },
              {
                icon: Car,
                title: 'Vehicle Requirements',
                color: 'neon-orange',
                items: [
                  'All vehicles must pass tech inspection before racing',
                  'Battery must be securely mounted',
                  'No fluid leaks of any kind',
                  'Throttle return spring required',
                  'Tow hooks/straps recommended',
                  'No loose items in the vehicle',
                  'Tires must be in good condition with adequate tread (class-specific)',
                ],
              },
              {
                icon: AlertTriangle,
                title: 'General Conduct',
                color: 'neon-cyan',
                items: [
                  'No alcohol or drugs permitted in the staging lanes or on the track',
                  'Speed limit of 10 mph in the pit area',
                  'All crew members must stay behind the starting line during runs',
                  'Burnouts only in designated burnout box',
                  'Follow all instructions from track officials',
                  'Respect other racers, crew, and spectators',
                ],
              },
            ].map((section, i) => (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="glass-card-hover">
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl bg-${section.color}/10 flex items-center justify-center`}>
                        <section.icon size={24} className={`text-${section.color}`} />
                      </div>
                      <CardTitle className="font-heading font-extrabold text-xl text-white tracking-wide">
                        {section.title}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {section.items.map((item, j) => (
                        <li key={j} className="flex items-start gap-3 text-gray-300 text-sm">
                          <span className={`w-1.5 h-1.5 rounded-full bg-${section.color} mt-1.5 flex-shrink-0`} />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            {/* Downloads */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="glass-card-hover border-neon-cyan/10">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-neon-cyan/10 flex items-center justify-center">
                      <FileText size={24} className="text-neon-cyan" />
                    </div>
                    <CardTitle className="font-heading font-extrabold text-xl text-white tracking-wide">
                      Downloads
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400 mb-4">
                    Download the complete PDRL rulebook and tech inspection checklist for reference.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <a
                      href="/pdrl-rulebook.pdf"
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-neon-cyan/10 border border-neon-cyan/20 rounded-lg text-neon-cyan text-sm font-semibold hover:bg-neon-cyan/20 hover:border-neon-cyan/40 transition-all duration-300"
                    >
                      <FileText size={16} />
                      PDRL Rulebook (PDF)
                    </a>
                    <a
                      href="/pdrl-tech-checklist.pdf"
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-gray-300 text-sm font-semibold hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                    >
                      <FileText size={16} />
                      Tech Checklist (PDF)
                    </a>
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