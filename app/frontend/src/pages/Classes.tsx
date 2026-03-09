import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Zap, Timer, Gauge, Shield } from 'lucide-react';

const classes = [
  {
    name: 'True Street',
    icon: Shield,
    color: 'neon-cyan',
    tagline: 'Daily drivers welcome',
    etRange: '12.00+',
    description: 'For street-legal, daily-driven vehicles. Minimal modifications allowed. Must pass street-legal inspection.',
    requirements: [
      'Must be street legal and registered',
      'Full exhaust system required',
      'DOT-approved tires only',
      'No slicks or drag radials',
      'Factory suspension geometry',
      'Must have working A/C, lights, and horn',
    ],
  },
  {
    name: 'Street Mod',
    icon: Timer,
    color: 'neon-cyan',
    tagline: 'Modified street machines',
    etRange: '10.00 – 11.99',
    description: 'For modified street vehicles. Bolt-on modifications, upgraded turbos, and aftermarket ECU tuning allowed.',
    requirements: [
      'Street-legal vehicle required',
      'Aftermarket turbo/supercharger allowed',
      'Drag radials permitted (no slicks)',
      'Roll cage required for 10-second cars',
      'Aftermarket ECU tuning allowed',
      'Must retain full interior',
    ],
  },
  {
    name: 'Pro Street',
    icon: Gauge,
    color: 'neon-red',
    tagline: 'Serious builds only',
    etRange: '8.50 – 9.99',
    description: 'For heavily modified vehicles. Full race builds with significant power upgrades and weight reduction.',
    requirements: [
      'Full roll cage mandatory (NHRA spec)',
      'Slick tires allowed',
      'Parachute required for 8-second cars',
      'Fire suppression system required',
      'SFI-rated bellhousing required',
      'Minimum weight restrictions apply',
    ],
  },
  {
    name: 'Pro',
    icon: Zap,
    color: 'neon-red',
    tagline: 'No limits racing',
    etRange: 'Sub 8.50',
    description: 'The fastest class. Purpose-built drag cars with no power limits. Full safety equipment mandatory.',
    requirements: [
      'Full NHRA-spec roll cage',
      'SFI-rated safety equipment',
      'Parachute mandatory',
      'On-board fire suppression',
      'SFI driveshaft loop',
      'Must meet all NHRA safety requirements',
    ],
  },
];

export default function Classes() {
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
              <span className="text-sm text-neon-cyan font-semibold">Race Classes</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-heading font-black text-white mb-4 tracking-tight">
              RACING <span className="text-neon-cyan">CLASSES</span>
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl">
              Four distinct classes ensure fair, competitive racing for every skill level and build type.
            </p>
          </motion.div>

          <div className="space-y-6">
            {classes.map((cls, i) => (
              <motion.div
                key={cls.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="glass-card-hover overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl bg-${cls.color}/10 flex items-center justify-center`}>
                          <cls.icon size={24} className={`text-${cls.color}`} />
                        </div>
                        <div>
                          <CardTitle className="font-heading font-extrabold text-xl text-white tracking-wide">
                            {cls.name}
                          </CardTitle>
                          <p className="text-sm text-gray-400 font-medium">{cls.tagline}</p>
                        </div>
                      </div>
                      <Badge className={`bg-${cls.color}/10 text-${cls.color} border border-${cls.color}/20 font-bold text-sm px-3 py-1`}>
                        ET: {cls.etRange}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-300 mb-5 leading-relaxed">{cls.description}</p>
                    <div className="grid md:grid-cols-2 gap-2">
                      {cls.requirements.map((req, j) => (
                        <div key={j} className="flex items-start gap-2.5 text-sm text-gray-400">
                          <span className={`w-1.5 h-1.5 rounded-full bg-${cls.color} mt-1.5 flex-shrink-0`} />
                          <span>{req}</span>
                        </div>
                      ))}
                    </div>
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