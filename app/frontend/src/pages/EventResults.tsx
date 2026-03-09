import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { createClient } from '@metagptx/web-sdk';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Trophy, Calendar, MapPin, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

const client = createClient();

interface RaceTime {
  id: number;
  registration_id: number;
  event_id: number;
  round: string | null;
  sixty_foot: number | null;
  three_thirty_foot: number | null;
  eighth_mile_time: number | null;
  eighth_mile_speed: number | null;
  quarter_mile_time: number | null;
  quarter_mile_speed: number | null;
  reaction_time: number | null;
  notes: string | null;
  race_date_time: string | null;
  lane: string | null;
  redlight: boolean | null;
  dial_in: number | null;
  driver_name: string | null;
  breakout: boolean | null;
  win: boolean | null;
}

interface Registration {
  id: number;
  event_id: number;
  driver_name: string;
  competition_number: string;
  class_name: string;
  car: string;
}

interface ResultEntry {
  driver_name: string;
  competition_number: string;
  class_name: string;
  car: string;
  best_quarter_time: number | null;
  best_quarter_speed: number | null;
  best_eighth_time: number | null;
  best_eighth_speed: number | null;
  best_reaction_time: number | null;
  best_sixty_foot: number | null;
  best_dial_in: number | null;
  has_redlight: boolean;
  has_breakout: boolean;
  wins: number;
  total_runs: number;
  runs: RaceTime[];
}

export default function EventResults() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<any>(null);
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [filteredResults, setFilteredResults] = useState<ResultEntry[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);

  useEffect(() => {
    if (eventId) loadEventResults(parseInt(eventId));
  }, [eventId]);

  useEffect(() => {
    if (selectedClass === 'all') setFilteredResults(results);
    else setFilteredResults(results.filter((r) => r.class_name === selectedClass));
  }, [selectedClass, results]);

  const loadEventResults = async (id: number) => {
    try {
      setLoading(true);
      const eventRes = await client.entities.events.get({ id: id.toString() });
      setEvent(eventRes.data);

      let registrations: Registration[] = [];
      try {
        const regsRes = await client.apiCall.invoke({ url: '/api/v1/registrations/public', method: 'GET', data: { skip: 0, limit: 500 } });
        registrations = (regsRes.data.items || []).filter((r: any) => r.event_id === id);
      } catch (err) {
        console.error('Failed to load registrations:', err);
      }

      let raceTimes: RaceTime[] = [];
      try {
        const timesRes = await client.apiCall.invoke({ url: '/api/v1/entities/race_times/all', method: 'GET', data: { query: JSON.stringify({ event_id: id }), limit: 500 } });
        raceTimes = timesRes.data.items || [];
      } catch (err) {
        console.error('Failed to load race times:', err);
      }

      const timesByReg = new Map<number, RaceTime[]>();
      raceTimes.forEach((rt) => {
        const existing = timesByReg.get(rt.registration_id) || [];
        existing.push(rt);
        timesByReg.set(rt.registration_id, existing);
      });

      const entries: ResultEntry[] = [];
      const classes = new Set<string>();

      registrations.forEach((reg) => {
        classes.add(reg.class_name);
        const runs = timesByReg.get(reg.id) || [];
        let bestQT: number | null = null, bestQS: number | null = null, bestET: number | null = null, bestES: number | null = null;
        let bestRT: number | null = null, bestSF: number | null = null, bestDI: number | null = null;
        let hasRedlight = false, hasBreakout = false, wins = 0;

        runs.forEach((run) => {
          if (run.quarter_mile_time && (bestQT === null || run.quarter_mile_time < bestQT)) { bestQT = run.quarter_mile_time; bestQS = run.quarter_mile_speed; }
          if (run.eighth_mile_time && (bestET === null || run.eighth_mile_time < bestET)) { bestET = run.eighth_mile_time; bestES = run.eighth_mile_speed; }
          if (run.reaction_time && (bestRT === null || run.reaction_time < bestRT)) bestRT = run.reaction_time;
          if (run.sixty_foot && (bestSF === null || run.sixty_foot < bestSF)) bestSF = run.sixty_foot;
          if (run.dial_in && (bestDI === null || run.dial_in < bestDI)) bestDI = run.dial_in;
          if (run.redlight === true) hasRedlight = true;
          if (run.breakout === true) hasBreakout = true;
          if (run.win === true) wins++;
        });

        entries.push({ driver_name: reg.driver_name, competition_number: reg.competition_number, class_name: reg.class_name, car: reg.car, best_quarter_time: bestQT, best_quarter_speed: bestQS, best_eighth_time: bestET, best_eighth_speed: bestES, best_reaction_time: bestRT, best_sixty_foot: bestSF, best_dial_in: bestDI, has_redlight: hasRedlight, has_breakout: hasBreakout, wins, total_runs: runs.length, runs });
      });

      entries.sort((a, b) => {
        if (a.best_quarter_time === null && b.best_quarter_time === null) return 0;
        if (a.best_quarter_time === null) return 1;
        if (b.best_quarter_time === null) return -1;
        return a.best_quarter_time - b.best_quarter_time;
      });

      setResults(entries);
      setFilteredResults(entries);
      setAvailableClasses(Array.from(classes).sort());
    } catch (error) {
      console.error('Error loading event results:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (val: number | null) => (val !== null ? val.toFixed(3) : '—');
  const formatSpeed = (val: number | null) => (val !== null ? val.toFixed(2) : '—');

  return (
    <div className="min-h-screen flex flex-col bg-dark-900 text-white">
      <Header />

      <main className="flex-1 py-12">
        <div className="container mx-auto px-4">
          <Link to="/events" className="inline-flex items-center gap-2 text-gray-400 hover:text-neon-cyan transition mb-6 text-sm font-medium">
            <ArrowLeft size={18} />
            Back to Events
          </Link>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !event ? (
            <Card className="glass-card">
              <CardContent className="py-12 text-center">
                <p className="text-gray-400 text-lg">Event not found.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <div className="flex items-center gap-3 mb-3">
                  <Trophy className="text-neon-cyan" size={28} />
                  <h1 className="text-3xl md:text-4xl font-heading font-black text-white tracking-wide">{event.title}</h1>
                  <Badge className="bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 font-bold">Results</Badge>
                </div>
                <div className="flex flex-wrap gap-4 text-gray-400">
                  <div className="flex items-center gap-2"><Calendar size={16} /><span className="font-medium">{event.date}</span></div>
                  <div className="flex items-center gap-2"><MapPin size={16} /><span className="font-medium">{event.location}</span></div>
                  {event.format && <div className="flex items-center gap-2"><Zap size={16} /><span className="font-medium">{event.format}</span></div>}
                </div>
              </motion.div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Total Entries', value: results.length },
                  { label: 'Classes', value: availableClasses.length },
                  { label: 'Recorded Runs', value: results.filter((r) => r.best_quarter_time !== null).length },
                  { label: 'Fastest 1/4 Mile', value: results.length > 0 && results[0].best_quarter_time ? formatTime(results[0].best_quarter_time) : '—' },
                ].map((stat, i) => (
                  <Card key={i} className="glass-card">
                    <CardContent className="pt-4 pb-4 text-center">
                      <div className="text-3xl font-heading font-black text-neon-cyan">{stat.value}</div>
                      <div className="text-sm text-gray-500 font-semibold">{stat.label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Filter */}
              <div className="flex items-center gap-4 mb-6">
                <span className="text-sm text-gray-400 font-semibold">Filter by Class:</span>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="w-48 bg-dark-900/50 border-white/10 text-white">
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent className="bg-dark-500 border-white/10">
                    <SelectItem value="all">All Classes</SelectItem>
                    {availableClasses.map((cls) => (<SelectItem key={cls} value={cls}>{cls}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              {/* Results Table */}
              <Card className="glass-card border-white/5">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2 font-heading font-bold tracking-wide">
                    <Trophy size={20} className="text-neon-cyan" />
                    Race Results
                    {selectedClass !== 'all' && <Badge className="bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 ml-2">{selectedClass}</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredResults.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No results available for this event.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-white/5">
                            <TableHead className="text-gray-400 font-bold">#</TableHead>
                            <TableHead className="text-gray-400 font-bold">Comp #</TableHead>
                            <TableHead className="text-gray-400 font-bold">Driver</TableHead>
                            <TableHead className="text-gray-400 font-bold">Car</TableHead>
                            <TableHead className="text-gray-400 font-bold">Class</TableHead>
                            <TableHead className="text-gray-400 font-bold text-right">Dial-in</TableHead>
                            <TableHead className="text-gray-400 font-bold text-right">RT</TableHead>
                            <TableHead className="text-gray-400 font-bold text-right">60ft</TableHead>
                            <TableHead className="text-gray-400 font-bold text-right">1/8 ET</TableHead>
                            <TableHead className="text-gray-400 font-bold text-right">1/8 MPH</TableHead>
                            <TableHead className="text-gray-400 font-bold text-right">1/4 ET</TableHead>
                            <TableHead className="text-gray-400 font-bold text-right">1/4 MPH</TableHead>
                            <TableHead className="text-gray-400 font-bold text-center">Wins</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredResults.map((entry, idx) => (
                            <TableRow key={`${entry.competition_number}-${idx}`} className={`border-white/5 transition-colors duration-200 ${idx < 3 ? 'bg-neon-cyan/[0.02]' : 'hover:bg-white/[0.02]'}`}>
                              <TableCell className="font-medium text-gray-500">
                                {idx === 0 && entry.best_quarter_time ? <span className="text-yellow-400">🏆</span> : idx === 1 && entry.best_quarter_time ? <span>🥈</span> : idx === 2 && entry.best_quarter_time ? <span>🥉</span> : idx + 1}
                              </TableCell>
                              <TableCell><Badge className="bg-neon-red/10 text-neon-red border-neon-red/20 font-mono">{entry.competition_number}</Badge></TableCell>
                              <TableCell><Link to={`/driver/${encodeURIComponent(entry.driver_name)}`} className="text-white hover:text-neon-cyan font-semibold transition-colors">{entry.driver_name}</Link></TableCell>
                              <TableCell className="text-gray-400">{entry.car}</TableCell>
                              <TableCell><Badge className="bg-white/5 text-gray-300 border border-white/10 text-xs">{entry.class_name}</Badge></TableCell>
                              <TableCell className="text-right font-mono text-gray-300">{formatTime(entry.best_dial_in)}</TableCell>
                              <TableCell className="text-right font-mono text-gray-300">{formatTime(entry.best_reaction_time)}</TableCell>
                              <TableCell className="text-right font-mono text-gray-300">{formatTime(entry.best_sixty_foot)}</TableCell>
                              <TableCell className="text-right font-mono text-gray-300">{formatTime(entry.best_eighth_time)}</TableCell>
                              <TableCell className="text-right font-mono text-gray-300">{formatSpeed(entry.best_eighth_speed)}</TableCell>
                              <TableCell className="text-right font-mono font-bold text-neon-cyan text-base">{formatTime(entry.best_quarter_time)}</TableCell>
                              <TableCell className="text-right font-mono text-gray-300">{formatSpeed(entry.best_quarter_speed)}</TableCell>
                              <TableCell className="text-center">
                                {entry.wins > 0 ? <Badge className="bg-green-500/10 text-green-400 border border-green-500/20 text-xs">{entry.wins}/{entry.total_runs}</Badge> : entry.total_runs > 0 ? <span className="text-gray-600">0/{entry.total_runs}</span> : <span className="text-gray-600">—</span>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
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