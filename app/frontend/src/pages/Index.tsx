import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createClient } from '@metagptx/web-sdk';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ImageLightbox from '@/components/ImageLightbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Clock, Trophy, Users, Zap, ChevronRight, Timer } from 'lucide-react';
import { fetchPublicEvents } from '@/lib/publicApi';
import { motion } from 'framer-motion';

const client = createClient();

export default function Index() {
  const [nextEvent, setNextEvent] = useState<any>(null);
  const [stats, setStats] = useState({ events: 0, racers: 0, classes: 4 });
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const events = await fetchPublicEvents({ limit: 50 });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcoming = events
          .filter((evt: any) => {
            const d = new Date(evt.date);
            d.setHours(0, 0, 0, 0);
            return evt.status === 'upcoming' && d >= today;
          })
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (upcoming.length > 0) {
          setNextEvent(upcoming[0]);
        }
        setStats((prev) => ({ ...prev, events: events.length }));

        try {
          const regsRes = await client.apiCall.invoke({
            url: '/api/v1/registrations/public',
            method: 'GET',
            data: { limit: 1 },
          });
          const total = regsRes.data.total || regsRes.data.items?.length || 0;
          setStats((prev) => ({ ...prev, racers: total }));
        } catch (err) {
          console.error('Failed to load registration stats:', err);
        }
      } catch (error) {
        console.error('Error loading homepage data:', error);
      }
    };
    loadData();
  }, []);

  const fadeUp = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 },
  };

  return (
    <div className="min-h-screen flex flex-col bg-dark-900 text-white">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-24 md:py-32">
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-dark-900 via-dark-900 to-neon-cyan/5" />
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-neon-cyan/5 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-neon-red/5 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/4" />

          <div className="container mx-auto px-4 relative z-10">
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
              {/* Left side - Text content */}
              <motion.div {...fadeUp} className="flex-1 max-w-4xl">
                <div className="inline-flex items-center gap-2 bg-neon-cyan/10 border border-neon-cyan/20 rounded-full px-4 py-2 mb-6">
                  <span className="w-2 h-2 bg-neon-cyan rounded-full animate-pulse" />
                  <span className="text-sm text-neon-cyan font-semibold tracking-wide">DRAG RACING LEAGUE</span>
                </div>

                <h1 className="text-5xl md:text-7xl lg:text-8xl font-heading font-black text-white mb-6 leading-[0.95] tracking-tight">
                  PRO DRAG
                  <br />
                  <span className="bg-gradient-to-r from-neon-cyan via-cyan-400 to-neon-cyan bg-clip-text text-transparent">
                    RACING
                  </span>
                  <br />
                  LEAGUE
                </h1>

                <p className="text-lg md:text-xl text-gray-400 max-w-2xl mb-8 font-medium leading-relaxed">
                  Organized, professional drag racing. Four classes. Single elimination.
                  Fair competition for every racer.
                </p>

                <div className="flex flex-wrap gap-4">
                  <Link to="/register">
                    <Button className="bg-gradient-to-r from-neon-cyan to-cyan-600 text-dark-900 font-extrabold text-base px-8 py-6 rounded-xl hover:shadow-[0_0_30px_rgba(0,212,255,0.4)] transition-all duration-300 hover:scale-105">
                      <Zap size={18} className="mr-2" />
                      Register Now
                    </Button>
                  </Link>
                  <Link to="/events">
                    <Button
                      variant="outline"
                      className="border-white/10 text-white font-bold text-base px-8 py-6 rounded-xl hover:bg-white/5 hover:border-neon-cyan/30 transition-all duration-300"
                    >
                      View Events
                      <ChevronRight size={18} className="ml-2" />
                    </Button>
                  </Link>
                </div>
              </motion.div>

              {/* Right side - PDRL Logo */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="flex-shrink-0"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-neon-cyan/10 rounded-full blur-[80px]" />
                  <img
                    src="/images/pdrl-logo.png"
                    alt="Pro Drag Racing League Logo"
                    className="relative z-10 w-[300px] md:w-[400px] lg:w-[500px] h-auto drop-shadow-[0_0_40px_rgba(0,212,255,0.3)]"
                  />
                </div>
              </motion.div>
            </div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="grid grid-cols-3 gap-4 md:gap-6 mt-16 max-w-2xl"
            >
              {[
                { icon: Calendar, label: 'Events', value: stats.events, color: 'neon-cyan' },
                { icon: Users, label: 'Racers', value: stats.racers, color: 'neon-red' },
                { icon: Trophy, label: 'Classes', value: stats.classes, color: 'neon-orange' },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="glass-card p-4 md:p-5 text-center group hover:border-neon-cyan/20 transition-all duration-300"
                >
                  <stat.icon size={20} className={`mx-auto mb-2 text-${stat.color}`} />
                  <div className={`text-3xl md:text-4xl font-heading font-black text-${stat.color} text-glow-cyan`}>
                    {stat.value}
                  </div>
                  <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mt-1">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Next Event Section */}
        {nextEvent && (
          <section className="py-16 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neon-cyan/[0.02] to-transparent" />
            <div className="container mx-auto px-4 relative z-10">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <div className="flex items-center gap-3 mb-8">
                  <div className="h-px flex-1 bg-gradient-to-r from-neon-cyan/30 to-transparent" />
                  <h2 className="font-heading font-extrabold text-2xl md:text-3xl text-white tracking-wider uppercase">
                    Next Event
                  </h2>
                  <div className="h-px flex-1 bg-gradient-to-l from-neon-cyan/30 to-transparent" />
                </div>

                <Card className="glass-card-hover border-neon-cyan/10 overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row">
                      {/* Flyer - click to expand */}
                      {nextEvent.flyer_url && (
                        <div
                          className="md:w-1/3 relative overflow-hidden cursor-pointer group/flyer"
                          onClick={() => {
                            setLightboxSrc(nextEvent.flyer_url);
                            setLightboxAlt(nextEvent.title);
                          }}
                        >
                          <img
                            src={nextEvent.flyer_url}
                            alt={nextEvent.title}
                            className="w-full h-64 md:h-full object-cover transition-transform duration-300 group-hover/flyer:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-dark-900/80 hidden md:block" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/flyer:bg-black/30 transition-colors duration-300">
                            <span className="text-white text-sm font-semibold opacity-0 group-hover/flyer:opacity-100 transition-opacity duration-300 bg-black/50 px-3 py-1.5 rounded-full">Click to expand</span>
                          </div>
                        </div>
                      )}

                      {/* Event details */}
                      <div className={`flex-1 p-6 md:p-8 ${nextEvent.flyer_url ? '' : 'w-full'}`}>
                        <Badge className="bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 font-bold mb-4">
                          <span className="w-1.5 h-1.5 bg-neon-cyan rounded-full mr-2 animate-pulse" />
                          Upcoming
                        </Badge>

                        <h3 className="text-2xl md:text-3xl font-heading font-extrabold text-white mb-4 tracking-wide">
                          {nextEvent.title}
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                          <div className="flex items-center gap-3 text-gray-300">
                            <Calendar size={16} className="text-neon-cyan" />
                            <span className="font-medium">{nextEvent.date}</span>
                          </div>
                          <div className="flex items-center gap-3 text-gray-300">
                            <MapPin size={16} className="text-neon-cyan" />
                            <span className="font-medium">{nextEvent.location}</span>
                          </div>
                          {nextEvent.start_time && (
                            <div className="flex items-center gap-3 text-gray-300">
                              <Clock size={16} className="text-neon-cyan" />
                              <span className="font-medium">{nextEvent.start_time} - {nextEvent.end_time}</span>
                            </div>
                          )}
                          {nextEvent.format && (
                            <div className="flex items-center gap-3 text-gray-300">
                              <Zap size={16} className="text-neon-cyan" />
                              <span className="font-medium">{nextEvent.format}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Link to="/register">
                            <Button className="bg-gradient-to-r from-neon-cyan to-cyan-600 text-dark-900 font-extrabold px-6 rounded-lg hover:shadow-[0_0_20px_rgba(0,212,255,0.3)] transition-all duration-300">
                              Register Now
                            </Button>
                          </Link>
                          <Link to="/events">
                            <Button variant="outline" className="border-white/10 text-gray-300 hover:text-white hover:border-neon-cyan/30 font-bold rounded-lg transition-all duration-300">
                              All Events
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </section>
        )}

        {/* Quick Links Section */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="grid md:grid-cols-3 gap-6"
            >
              {[
                {
                  icon: Trophy,
                  title: 'Leaderboard',
                  desc: 'See who tops the rankings this season.',
                  link: '/leaderboard',
                  color: 'neon-cyan',
                },
                {
                  icon: Timer,
                  title: 'Race Classes',
                  desc: 'Four classes from True Street to Pro.',
                  link: '/classes',
                  color: 'neon-red',
                },
                {
                  icon: Users,
                  title: 'Members Garage',
                  desc: 'Showcase your build and see others.',
                  link: '/garage',
                  color: 'neon-orange',
                },
              ].map((item, i) => (
                <Link key={i} to={item.link}>
                  <Card className="glass-card-hover h-full group cursor-pointer">
                    <CardContent className="p-6">
                      <div className={`w-12 h-12 rounded-xl bg-${item.color}/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                        <item.icon size={24} className={`text-${item.color}`} />
                      </div>
                      <h3 className="font-heading font-bold text-white text-lg mb-2 tracking-wide group-hover:text-neon-cyan transition-colors duration-300">
                        {item.title}
                      </h3>
                      <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                      <div className="flex items-center gap-1 mt-4 text-neon-cyan text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        Explore <ChevronRight size={14} />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />

      <ImageLightbox
        src={lightboxSrc}
        alt={lightboxAlt}
        onClose={() => setLightboxSrc(null)}
      />
    </div>
  );
}