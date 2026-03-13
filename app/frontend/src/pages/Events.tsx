import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ImageLightbox from '@/components/ImageLightbox';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Clock, Zap, Trophy, ChevronRight, FileUp } from 'lucide-react';
import { fetchPublicEvents } from '@/lib/publicApi';
import { motion } from 'framer-motion';

export default function Events() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState('');

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const items = await fetchPublicEvents({ limit: 50 });
        setEvents(items);
      } catch (error) {
        console.error('Error loading events:', error);
      } finally {
        setLoading(false);
      }
    };
    loadEvents();
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = events
    .filter((e) => {
      const d = new Date(e.date);
      d.setHours(0, 0, 0, 0);
      return e.status === 'upcoming' && d >= today;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const completed = events.filter((e) => e.status === 'completed');

  return (
    <div className="min-h-screen flex flex-col bg-dark-900 text-white">
      <Header />

      <main className="flex-1 py-12">
        <div className="container mx-auto px-4">
          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="inline-flex items-center gap-2 bg-neon-cyan/10 border border-neon-cyan/20 rounded-full px-4 py-2 mb-4">
              <Calendar size={14} className="text-neon-cyan" />
              <span className="text-sm text-neon-cyan font-semibold">Events</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-heading font-black text-white mb-4 tracking-tight">
              RACE <span className="text-neon-cyan">EVENTS</span>
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl">
              Upcoming races, past results, and everything you need to know about PDRL events.
            </p>
          </motion.div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Upcoming Events */}
              {upcoming.length > 0 && (
                <div className="mb-16">
                  <h2 className="font-heading font-bold text-xl text-white mb-6 tracking-wider uppercase flex items-center gap-3">
                    <Zap size={20} className="text-neon-cyan" />
                    Upcoming Events
                  </h2>
                  <div className="space-y-6">
                    {upcoming.map((evt, i) => (
                      <motion.div
                        key={evt.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        <Card className="glass-card-hover overflow-hidden border-neon-cyan/10">
                          <CardContent className="p-0">
                            <div className="flex flex-col md:flex-row">
                              {/* Flyer - click to expand */}
                              {evt.flyer_url && (
                                <div
                                  className="md:w-64 relative overflow-hidden flex-shrink-0 cursor-pointer group/flyer"
                                  onClick={() => {
                                    setLightboxSrc(evt.flyer_url);
                                    setLightboxAlt(evt.title);
                                  }}
                                >
                                  <img src={evt.flyer_url} alt={evt.title} className="w-full h-48 md:h-full object-cover transition-transform duration-300 group-hover/flyer:scale-105" />
                                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-dark-900/60 hidden md:block" />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/flyer:bg-black/30 transition-colors duration-300">
                                    <span className="text-white text-sm font-semibold opacity-0 group-hover/flyer:opacity-100 transition-opacity duration-300 bg-black/50 px-3 py-1.5 rounded-full">Click to expand</span>
                                  </div>
                                </div>
                              )}
                              <div className="flex-1 p-6">
                                <div className="flex items-start justify-between mb-3">
                                  <div>
                                    <Badge className="bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 font-bold mb-2">
                                      <span className="w-1.5 h-1.5 bg-neon-cyan rounded-full mr-2 animate-pulse" />
                                      Upcoming
                                    </Badge>
                                    <h3 className="text-xl font-heading font-bold text-white tracking-wide">{evt.title}</h3>
                                  </div>
                                  {evt.price && (
                                    <Badge className="bg-neon-red/10 text-neon-red border border-neon-red/20 font-bold">
                                      {evt.price}
                                    </Badge>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                                  <div className="flex items-center gap-2 text-gray-400">
                                    <Calendar size={14} className="text-neon-cyan" />
                                    <span>{evt.date}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-gray-400">
                                    <MapPin size={14} className="text-neon-cyan" />
                                    <span>{evt.location}</span>
                                  </div>
                                  {evt.start_time && (
                                    <div className="flex items-center gap-2 text-gray-400">
                                      <Clock size={14} className="text-neon-cyan" />
                                      <span>{evt.start_time} - {evt.end_time}</span>
                                    </div>
                                  )}
                                  {evt.format && (
                                    <div className="flex items-center gap-2 text-gray-400">
                                      <Zap size={14} className="text-neon-cyan" />
                                      <span>{evt.format}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-3">
                                  {i === 0 ? (
                                    <Link to="/register">
                                      <Button className="bg-gradient-to-r from-neon-cyan to-cyan-600 text-dark-900 font-bold rounded-lg hover:shadow-[0_0_15px_rgba(0,212,255,0.3)] transition-all duration-300" size="sm">
                                        Register
                                      </Button>
                                    </Link>
                                  ) : (
                                    <Button disabled className="bg-white/5 text-gray-500 border border-white/10 font-bold rounded-lg cursor-not-allowed" size="sm">
                                      Registration Opens Soon
                                    </Button>
                                  )}
                                  {evt.asr_url && (
                                    <a
                                      href={evt.asr_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/30 hover:border-orange-500/50 font-semibold rounded-lg transition-all duration-300 text-sm"
                                    >
                                      <FileUp size={14} />
                                      View Event ASRs
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Events */}
              {completed.length > 0 && (
                <div>
                  <h2 className="font-heading font-bold text-xl text-white mb-6 tracking-wider uppercase flex items-center gap-3">
                    <Trophy size={20} className="text-neon-red" />
                    Completed Events
                  </h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    {completed.map((evt, i) => (
                      <motion.div
                        key={evt.id}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <Card className="glass-card-hover group">
                          <CardContent className="p-5">
                            {/* Show flyer thumbnail for completed events - click to expand */}
                            {evt.flyer_url && (
                              <div
                                className="w-full h-32 rounded-lg overflow-hidden mb-3 cursor-pointer group/flyer"
                                onClick={() => {
                                  setLightboxSrc(evt.flyer_url);
                                  setLightboxAlt(evt.title);
                                }}
                              >
                                <img src={evt.flyer_url} alt={evt.title} className="w-full h-full object-cover transition-transform duration-300 group-hover/flyer:scale-105" />
                              </div>
                            )}
                            <div className="flex items-start justify-between mb-3">
                              <h3 className="font-heading font-bold text-white text-base tracking-wide group-hover:text-neon-cyan transition-colors">
                                {evt.title}
                              </h3>
                              <Badge className="bg-white/5 text-gray-400 border border-white/10 text-xs font-semibold">
                                Completed
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-3 text-sm text-gray-400 mb-4">
                              <span className="flex items-center gap-1.5"><Calendar size={13} className="text-gray-500" />{evt.date}</span>
                              <span className="flex items-center gap-1.5"><MapPin size={13} className="text-gray-500" />{evt.location}</span>
                            </div>
                            <div className="flex gap-2">
                              <Link to={`/events/${evt.id}/results`}>
                                <Button variant="outline" size="sm" className="border-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/10 hover:border-neon-cyan/40 font-semibold transition-all duration-300">
                                  View Results <ChevronRight size={14} className="ml-1" />
                                </Button>
                              </Link>
                              {evt.asr_url && (
                                <a
                                  href={evt.asr_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/30 hover:border-orange-500/50 font-semibold rounded-lg transition-all duration-300 text-sm"
                                >
                                  <FileUp size={14} />
                                  ASR
                                </a>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {events.length === 0 && (
                <Card className="glass-card">
                  <CardContent className="py-16 text-center">
                    <Calendar size={48} className="mx-auto mb-4 text-gray-600" />
                    <p className="text-gray-400 text-lg">No events available yet. Check back soon!</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
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