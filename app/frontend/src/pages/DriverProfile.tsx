import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { createClient } from '@metagptx/web-sdk';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Trophy, Gauge, Timer, Zap, User, Car, Calendar, MapPin, ArrowLeft, Search, ChevronDown, ChevronUp,
} from 'lucide-react';
import { motion } from 'framer-motion';

const client = createClient();

interface DriverData {
  driver_name: string;
  competition_number: string;
  car: string;
  class_name: string;
  phone: string;
  total_events: number;
  total_runs: number;
  best_quarter_time: number | null;
  best_quarter_speed: number | null;
  best_eighth_time: number | null;
  best_reaction_time: number | null;
  best_sixty_foot: number | null;
  registrations: Registration[];
  race_times: RaceTime[];
}

interface Registration {
  id: number;
  event_id: number;
  event_title: string;
  event_date: string;
  event_location: string;
  competition_number: string;
  class_name: string;
  car: string;
  notes: string;
  payment_status: string;
}

interface RaceTime {
  id: number;
  registration_id: number;
  event_id: number;
  event_title: string;
  event_date: string;
  round: string;
  sixty_foot: number | null;
  three_thirty_foot: number | null;
  eighth_mile_time: number | null;
  eighth_mile_speed: number | null;
  quarter_mile_time: number | null;
  quarter_mile_speed: number | null;
  reaction_time: number | null;
  notes: string;
  recorded_at: string | null;
  class_name: string;
  car: string;
  competition_number: string;
  race_date_time: string | null;
  lane: string | null;
  redlight: boolean | null;
  dial_in: number | null;
  driver_name: string | null;
  breakout: boolean | null;
  win: boolean | null;
}

function formatTime(val: number | null | undefined): string {
  if (val === null || val === undefined) return '—';
  return val.toFixed(3);
}

function formatSpeed(val: number | null | undefined): string {
  if (val === null || val === undefined) return '—';
  return val.toFixed(2);
}

export default function DriverProfile() {
  const { driverName } = useParams<{ driverName: string }>();
  const navigate = useNavigate();
  const [driver, setDriver] = useState<DriverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (driverName) {
      loadDriverProfile(decodeURIComponent(driverName));
    } else {
      setLoading(false);
      setShowSearch(true);
    }
  }, [driverName]);

  const loadDriverProfile = async (name: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await client.apiCall.invoke({
        url: '/api/v1/driver/profile',
        method: 'GET',
        data: { driver_name: name },
      });
      setDriver(response.data);
      setShowSearch(false);
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.data?.detail?.includes('not found')) {
        setError('Driver not found. Please check the name and try again.');
      } else {
        setError('Failed to load driver profile. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) { setSearchResults([]); return; }
    try {
      setSearching(true);
      const response = await client.apiCall.invoke({
        url: '/api/v1/driver/search',
        method: 'GET',
        data: { q: query },
      });
      setSearchResults(response.data.items || []);
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  };

  const selectDriver = (name: string) => navigate(`/driver/${encodeURIComponent(name)}`);
  const toggleEventExpand = (eventId: number) => setExpandedEvent(expandedEvent === eventId ? null : eventId);

  const raceTimesByEvent = driver?.race_times.reduce<Record<string, RaceTime[]>>((acc, rt) => {
    const key = `${rt.event_id}-${rt.event_title}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(rt);
    return acc;
  }, {}) || {};

  return (
    <div className="min-h-screen flex flex-col bg-dark-900 text-white">
      <Header />

      <main className="flex-1 py-12">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <Link to="/leaderboard" className="inline-flex items-center gap-2 text-gray-400 hover:text-neon-cyan mb-4 transition-colors text-sm font-medium">
              <ArrowLeft size={16} />
              Back to Leaderboard
            </Link>

            <div className="inline-flex items-center gap-2 bg-neon-cyan/10 border border-neon-cyan/20 rounded-full px-4 py-2 mb-4 block">
              <User className="text-neon-cyan" size={14} />
              <span className="text-sm text-neon-cyan font-semibold">Driver Profile</span>
            </div>

            {!driverName && (
              <>
                <h1 className="text-4xl md:text-5xl font-heading font-black text-white mb-4 tracking-tight">
                  FIND A <span className="text-neon-cyan">DRIVER</span>
                </h1>
                <p className="text-lg text-gray-400 mb-6">
                  Search for a driver to view their profile, stats, and race history.
                </p>
              </>
            )}
          </div>

          {/* Search Section */}
          {(showSearch || !driverName) && (
            <Card className="glass-card border-neon-cyan/10 mb-8">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2 font-heading font-bold tracking-wide">
                  <Search size={20} className="text-neon-cyan" />
                  Search Drivers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Input
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Type a driver name to search..."
                    className="bg-dark-900/50 border-white/10 text-white text-lg py-6 focus:ring-neon-cyan/50 focus:border-neon-cyan/30"
                    autoFocus
                  />
                  {searching && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">Searching...</div>}
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {searchResults.map((d, idx) => (
                      <button key={idx} onClick={() => selectDriver(d.driver_name)} className="w-full text-left p-4 glass-card hover:border-neon-cyan/20 hover:bg-white/[0.04] rounded-xl transition-all duration-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-neon-cyan/10 rounded-full flex items-center justify-center">
                              <User size={18} className="text-neon-cyan" />
                            </div>
                            <div>
                              <p className="text-white font-semibold">{d.driver_name}</p>
                              <p className="text-sm text-gray-500">{d.car}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge className="bg-white/5 text-gray-400 border border-white/10 text-xs">{d.class_name}</Badge>
                            {d.competition_number && <p className="text-xs text-neon-red font-bold mt-1">#{d.competition_number}</p>}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
                  <p className="text-gray-500 mt-4 text-center">No drivers found matching "{searchQuery}"</p>
                )}
              </CardContent>
            </Card>
          )}

          {loading && (
            <Card className="glass-card">
              <CardContent className="py-16 text-center">
                <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-400 text-lg">Loading driver profile...</p>
              </CardContent>
            </Card>
          )}

          {error && !loading && (
            <Card className="glass-card">
              <CardContent className="py-16 text-center">
                <User className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-300 text-lg font-semibold mb-2">{error}</p>
                <Button onClick={() => { setShowSearch(true); setError(null); }} className="bg-gradient-to-r from-neon-cyan to-cyan-600 text-dark-900 font-bold mt-4">
                  Search for a Driver
                </Button>
              </CardContent>
            </Card>
          )}

          {driver && !loading && (
            <>
              {/* Driver Header */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="glass-card border-neon-cyan/10 mb-8">
                  <CardContent className="pt-8 pb-8">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                      <div className="w-20 h-20 bg-gradient-to-br from-neon-cyan to-cyan-700 rounded-full flex items-center justify-center flex-shrink-0 glow-cyan">
                        <span className="text-3xl font-heading font-black text-dark-900">{driver.driver_name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <h1 className="text-3xl md:text-4xl font-heading font-black text-white tracking-wide">{driver.driver_name}</h1>
                          {driver.competition_number && (
                            <Badge className="bg-neon-red/10 text-neon-red border border-neon-red/20 text-lg px-3 py-1 font-bold">#{driver.competition_number}</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-gray-400">
                          <span className="flex items-center gap-1.5"><Car size={16} className="text-neon-cyan" />{driver.car}</span>
                          <span className="flex items-center gap-1.5"><Zap size={16} className="text-neon-cyan" />{driver.class_name}</span>
                          <span className="flex items-center gap-1.5"><Calendar size={16} className="text-neon-cyan" />{driver.total_events} Event{driver.total_events !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <Button variant="outline" className="border-white/10 text-gray-300 hover:text-neon-cyan hover:border-neon-cyan/30 font-bold" onClick={() => setShowSearch(!showSearch)}>
                        <Search size={16} className="mr-2" />
                        Search Driver
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                {[
                  { icon: Trophy, label: 'Best 1/4 Mile', value: driver.best_quarter_time ? `${formatTime(driver.best_quarter_time)}s` : '—', color: 'text-yellow-400' },
                  { icon: Gauge, label: 'Top Speed', value: driver.best_quarter_speed ? `${formatSpeed(driver.best_quarter_speed)} mph` : '—', color: 'text-blue-400' },
                  { icon: Timer, label: 'Best 1/8 Mile', value: driver.best_eighth_time ? `${formatTime(driver.best_eighth_time)}s` : '—', color: 'text-green-400' },
                  { icon: Zap, label: 'Best Reaction', value: driver.best_reaction_time ? `${formatTime(driver.best_reaction_time)}s` : '—', color: 'text-orange-400' },
                  { icon: Zap, label: 'Best 60ft', value: driver.best_sixty_foot ? `${formatTime(driver.best_sixty_foot)}s` : '—', color: 'text-purple-400' },
                ].map((stat, i) => (
                  <Card key={i} className="glass-card">
                    <CardContent className="pt-5 pb-5 text-center">
                      <stat.icon className={`w-5 h-5 ${stat.color} mx-auto mb-2`} />
                      <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">{stat.label}</div>
                      <div className="text-xl font-heading font-black text-neon-cyan">{stat.value}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Race Times History */}
              <Card className="glass-card border-white/5 mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white font-heading font-bold tracking-wide">
                    <Timer className="text-neon-cyan" size={22} />
                    Race Times ({driver.total_runs} Run{driver.total_runs !== 1 ? 's' : ''})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {driver.race_times.length === 0 ? (
                    <div className="py-12 text-center">
                      <Timer className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                      <p className="text-gray-500 text-lg">No race times recorded yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(raceTimesByEvent).map(([eventKey, times]) => {
                        const eventId = parseInt(eventKey.split('-')[0]);
                        const eventTitle = times[0]?.event_title || 'Unknown Event';
                        const eventDate = times[0]?.event_date || 'N/A';
                        const isExpanded = expandedEvent === eventId;
                        const bestInEvent = times.reduce<RaceTime | null>((best, t) => {
                          if (!t.quarter_mile_time) return best;
                          if (!best || !best.quarter_mile_time || t.quarter_mile_time < best.quarter_mile_time) return t;
                          return best;
                        }, null);

                        return (
                          <div key={eventKey} className="border border-white/5 rounded-xl overflow-hidden">
                            <button onClick={() => toggleEventExpand(eventId)} className="w-full flex items-center justify-between p-4 bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-left">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-neon-cyan/10 rounded-lg flex items-center justify-center">
                                  <Calendar size={18} className="text-neon-cyan" />
                                </div>
                                <div>
                                  <h3 className="text-white font-semibold">{eventTitle}</h3>
                                  <p className="text-sm text-gray-500">{eventDate} • {times.length} run{times.length !== 1 ? 's' : ''}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                {bestInEvent?.quarter_mile_time && (
                                  <div className="text-right mr-2">
                                    <div className="text-xs text-gray-500">Best</div>
                                    <div className="text-lg font-heading font-bold text-neon-cyan">{formatTime(bestInEvent.quarter_mile_time)}s</div>
                                  </div>
                                )}
                                {isExpanded ? <ChevronUp size={20} className="text-gray-500" /> : <ChevronDown size={20} className="text-gray-500" />}
                              </div>
                            </button>
                            {isExpanded && (
                              <div className="overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="border-white/5">
                                      <TableHead className="text-gray-400 font-bold">Round</TableHead>
                                      <TableHead className="text-right text-gray-400 font-bold">Reaction</TableHead>
                                      <TableHead className="text-right text-gray-400 font-bold">60ft</TableHead>
                                      <TableHead className="text-right text-gray-400 font-bold">330ft</TableHead>
                                      <TableHead className="text-right text-gray-400 font-bold">1/8 Mile</TableHead>
                                      <TableHead className="text-right text-gray-400 font-bold">1/8 Speed</TableHead>
                                      <TableHead className="text-right text-gray-400 font-bold">1/4 Mile</TableHead>
                                      <TableHead className="text-right text-gray-400 font-bold">1/4 Speed</TableHead>
                                      <TableHead className="text-gray-400 font-bold">Notes</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {times.map((rt) => {
                                      const isBest = bestInEvent?.id === rt.id;
                                      return (
                                        <TableRow key={rt.id} className={`border-white/5 ${isBest ? 'bg-neon-cyan/[0.03]' : 'hover:bg-white/[0.02]'}`}>
                                          <TableCell className="font-medium text-white">
                                            <div className="flex items-center gap-2">
                                              {rt.round || '—'}
                                              {isBest && <Badge className="bg-yellow-500/10 text-yellow-400 text-xs border-yellow-500/20">Best</Badge>}
                                            </div>
                                          </TableCell>
                                          <TableCell className="text-right text-gray-300">{formatTime(rt.reaction_time)}</TableCell>
                                          <TableCell className="text-right text-gray-300">{formatTime(rt.sixty_foot)}</TableCell>
                                          <TableCell className="text-right text-gray-300">{formatTime(rt.three_thirty_foot)}</TableCell>
                                          <TableCell className="text-right text-gray-300">{formatTime(rt.eighth_mile_time)}</TableCell>
                                          <TableCell className="text-right text-gray-300">{rt.eighth_mile_speed ? `${formatSpeed(rt.eighth_mile_speed)} mph` : '—'}</TableCell>
                                          <TableCell className={`text-right font-bold text-base ${isBest ? 'text-neon-cyan' : 'text-gray-200'}`}>{rt.quarter_mile_time ? `${formatTime(rt.quarter_mile_time)}s` : '—'}</TableCell>
                                          <TableCell className="text-right text-gray-300">{rt.quarter_mile_speed ? `${formatSpeed(rt.quarter_mile_speed)} mph` : '—'}</TableCell>
                                          <TableCell className="text-gray-500 text-sm max-w-[150px] truncate">{rt.notes || '—'}</TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Event History */}
              <Card className="glass-card border-white/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white font-heading font-bold tracking-wide">
                    <Calendar className="text-neon-cyan" size={22} />
                    Event History ({driver.registrations.length} Registration{driver.registrations.length !== 1 ? 's' : ''})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {driver.registrations.length === 0 ? (
                    <div className="py-12 text-center">
                      <Calendar className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                      <p className="text-gray-500 text-lg">No event registrations found.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {driver.registrations.map((reg) => (
                        <div key={reg.id} className="p-4 glass-card hover:border-neon-cyan/20 transition-all duration-300">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-white font-semibold">{reg.event_title}</h3>
                              <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                                <span className="flex items-center gap-1"><Calendar size={13} />{reg.event_date}</span>
                                <span className="flex items-center gap-1"><MapPin size={13} />{reg.event_location}</span>
                              </div>
                            </div>
                            <Badge className={`text-xs ${reg.payment_status === 'confirmed' || reg.payment_status === 'paid' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                              {reg.payment_status || 'pending'}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-3 text-sm">
                            <span className="flex items-center gap-1 text-gray-400"><Car size={13} className="text-neon-cyan" />{reg.car}</span>
                            <Badge className="bg-white/5 text-gray-400 border border-white/10 text-xs">{reg.class_name}</Badge>
                            {reg.competition_number && <Badge className="bg-neon-red/10 text-neon-red border border-neon-red/20 text-xs font-bold">#{reg.competition_number}</Badge>}
                          </div>
                          {reg.notes && <p className="text-xs text-gray-600 mt-2 truncate">{reg.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}