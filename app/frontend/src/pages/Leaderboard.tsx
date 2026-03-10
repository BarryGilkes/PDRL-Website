import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createClient } from '@metagptx/web-sdk';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, Zap, Timer, Gauge } from 'lucide-react';
import { motion } from 'framer-motion';

const client = createClient();

interface LeaderboardEntry {
  driver_name: string;
  competition_number: string;
  car: string;
  class_name: string;
  best_time: number | null;
  best_speed: number | null;
  event_title: string;
  event_date: string;
}

type DistanceMode = 'quarter' | 'eighth';

const fmtTime = (val: number | null | undefined): string =>
  val != null ? `${val.toFixed(3)}s` : 'N/A';

const fmtSpeed = (val: number | null | undefined): string =>
  val != null ? `${val.toFixed(2)} mph` : 'N/A';

const distanceLabel = (mode: DistanceMode): string =>
  mode === 'quarter' ? '1/4 Mile' : '1/8 Mile';

export default function Leaderboard() {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [filteredData, setFilteredData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState('all');
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState('all');
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [distance, setDistance] = useState<DistanceMode>('eighth');

  useEffect(() => {
    loadLeaderboard();
  }, [distance]);

  // Extract available classes whenever data changes
  useEffect(() => {
    const classes = Array.from(
      new Set(data.map((e) => e.class_name).filter(Boolean)),
    ).sort();
    setAvailableClasses(classes);
    // Reset class selection if the current choice is no longer available
    if (selectedClass !== 'all' && !classes.includes(selectedClass)) {
      setSelectedClass('all');
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let filtered = data;
    if (selectedYear !== 'all') {
      filtered = filtered.filter((e) => e.event_date?.startsWith(selectedYear));
    }
    if (selectedClass !== 'all') {
      filtered = filtered.filter((e) => e.class_name === selectedClass);
    }
    setFilteredData(filtered);
  }, [selectedYear, selectedClass, data]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const response = await client.apiCall.invoke({
        url: `/api/v1/leaderboard?distance=${distance}`,
        method: 'GET',
      });
      const items: LeaderboardEntry[] = response.data.items || [];
      items.sort((a, b) => {
        if (a.best_time == null && b.best_time == null) return 0;
        if (a.best_time == null) return 1;
        if (b.best_time == null) return -1;
        return a.best_time - b.best_time;
      });
      setData(items);

      const years = Array.from(new Set(items.map((e) => e.event_date?.substring(0, 4)).filter(Boolean)));
      years.sort((a, b) => parseInt(b) - parseInt(a));
      setAvailableYears(years);

      // Auto-select the most recent year if available
      if (years.length > 0) {
        setSelectedYear(years[0]);
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return <span className="text-2xl">🏆</span>;
    if (index === 1) return <span className="text-2xl">🥈</span>;
    if (index === 2) return <span className="text-2xl">🥉</span>;
    return <span className="text-gray-500 font-bold">{index + 1}</span>;
  };

  // Compute stats safely
  const validTimes = filteredData.filter((e) => e.best_time != null);
  const validSpeeds = filteredData.filter((e) => e.best_speed != null);
  const fastestTime = validTimes.length > 0 ? fmtTime(validTimes[0].best_time) : 'N/A';
  const topSpeed = validSpeeds.length > 0
    ? `${Math.max(...validSpeeds.map((e) => e.best_speed!)).toFixed(2)} mph`
    : 'N/A';
  const avgTime = validTimes.length > 0
    ? `${(validTimes.reduce((sum, e) => sum + e.best_time!, 0) / validTimes.length).toFixed(3)}s`
    : 'N/A';

  return (
    <div className="min-h-screen flex flex-col bg-dark-900 text-white">
      <Header />

      <main className="flex-1 py-12">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="inline-flex items-center gap-2 bg-neon-cyan/10 border border-neon-cyan/20 rounded-full px-4 py-2 mb-4">
              <Trophy size={14} className="text-neon-cyan" />
              <span className="text-sm text-neon-cyan font-semibold">Leaderboard</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-heading font-black text-white tracking-tight mb-6">
              LEADER<span className="text-neon-cyan">BOARD</span>
            </h1>

            {/* Distance Toggle & Year Filter Row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400 font-semibold uppercase tracking-wider">Distance:</span>
                <div className="inline-flex rounded-lg border-2 border-white/20 bg-dark-500/80 p-1 gap-1">
                  <button
                    onClick={() => setDistance('eighth')}
                    className={`px-5 py-2.5 rounded-md text-sm font-bold transition-all duration-300 ${
                      distance === 'eighth'
                        ? 'bg-neon-cyan text-black shadow-[0_0_15px_rgba(0,212,255,0.4)]'
                        : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    1/8 Mile
                  </button>
                  <button
                    onClick={() => setDistance('quarter')}
                    className={`px-5 py-2.5 rounded-md text-sm font-bold transition-all duration-300 ${
                      distance === 'quarter'
                        ? 'bg-neon-cyan text-black shadow-[0_0_15px_rgba(0,212,255,0.4)]'
                        : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    1/4 Mile
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400 font-semibold uppercase tracking-wider">Year:</span>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-36 bg-dark-500/80 border-2 border-white/20 text-white focus:ring-neon-cyan/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-dark-500 border-white/10">
                    <SelectItem value="all">All Years</SelectItem>
                    {availableYears.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400 font-semibold uppercase tracking-wider">Class:</span>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="w-44 bg-dark-500/80 border-2 border-white/20 text-white focus:ring-neon-cyan/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-dark-500 border-white/10">
                    <SelectItem value="all">All Classes</SelectItem>
                    {availableClasses.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Current distance indicator */}
            <p className="text-gray-400 text-sm mt-3">
              Showing best <span className="text-neon-cyan font-bold text-base">{distanceLabel(distance)}</span> times
            </p>
          </motion.div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredData.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-16 text-center">
                <Trophy size={48} className="mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400 text-lg">No leaderboard data available{selectedYear !== 'all' ? ` for ${selectedYear}` : ''}{selectedClass !== 'all' ? ` in ${selectedClass}` : ''} ({distanceLabel(distance)}).</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Podium */}
              {filteredData.length >= 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="grid grid-cols-3 gap-4 mb-10"
                >
                  {/* 2nd Place */}
                  <div className="flex flex-col items-center pt-8">
                    <Card className="glass-card w-full text-center border-gray-500/20 hover:border-gray-400/30 transition-all duration-300">
                      <CardContent className="pt-6 pb-5">
                        <span className="text-3xl mb-2 block">🥈</span>
                        <div className="text-sm font-bold text-white mb-1 truncate">{filteredData[1].driver_name}</div>
                        <div className="text-2xl font-heading font-black text-gray-300">{fmtTime(filteredData[1].best_time)}</div>
                        <div className="text-xs text-gray-500 mt-1">{fmtSpeed(filteredData[1].best_speed)}</div>
                        <Badge className="mt-2 bg-white/5 text-gray-400 border border-white/10 text-xs">{filteredData[1].class_name}</Badge>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 1st Place */}
                  <div className="flex flex-col items-center">
                    <Card className="glass-card w-full text-center border-neon-cyan/20 glow-cyan hover:glow-cyan-strong transition-all duration-300">
                      <CardContent className="pt-6 pb-5">
                        <span className="text-4xl mb-2 block">🏆</span>
                        <div className="text-sm font-bold text-white mb-1 truncate">{filteredData[0].driver_name}</div>
                        <div className="text-3xl font-heading font-black text-neon-cyan text-glow-cyan">{fmtTime(filteredData[0].best_time)}</div>
                        <div className="text-xs text-gray-400 mt-1">{fmtSpeed(filteredData[0].best_speed)}</div>
                        <Badge className="mt-2 bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 text-xs">{filteredData[0].class_name}</Badge>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 3rd Place */}
                  <div className="flex flex-col items-center pt-12">
                    <Card className="glass-card w-full text-center border-neon-orange/20 hover:border-neon-orange/30 transition-all duration-300">
                      <CardContent className="pt-6 pb-5">
                        <span className="text-3xl mb-2 block">🥉</span>
                        <div className="text-sm font-bold text-white mb-1 truncate">{filteredData[2].driver_name}</div>
                        <div className="text-2xl font-heading font-black text-neon-orange">{fmtTime(filteredData[2].best_time)}</div>
                        <div className="text-xs text-gray-500 mt-1">{fmtSpeed(filteredData[2].best_speed)}</div>
                        <Badge className="mt-2 bg-neon-orange/10 text-neon-orange border border-neon-orange/20 text-xs">{filteredData[2].class_name}</Badge>
                      </CardContent>
                    </Card>
                  </div>
                </motion.div>
              )}

              {/* Full Table */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="glass-card border-white/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white font-heading font-bold tracking-wide">
                      <Zap className="text-neon-cyan" size={22} />
                      Complete Rankings — {distanceLabel(distance)} — {selectedYear === 'all' ? 'All Years' : selectedYear}{selectedClass !== 'all' ? ` — ${selectedClass}` : ''}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-white/5">
                            <TableHead className="text-gray-400 font-bold">Rank</TableHead>
                            <TableHead className="text-gray-400 font-bold">Comp #</TableHead>
                            <TableHead className="text-gray-400 font-bold">Driver</TableHead>
                            <TableHead className="text-gray-400 font-bold">Car</TableHead>
                            <TableHead className="text-gray-400 font-bold">Class</TableHead>
                            <TableHead className="text-right text-gray-400 font-bold">{distanceLabel(distance)}</TableHead>
                            <TableHead className="text-right text-gray-400 font-bold">Speed</TableHead>
                            <TableHead className="text-gray-400 font-bold">Event</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredData.map((entry, index) => (
                            <TableRow
                              key={index}
                              className={`border-white/5 transition-colors duration-200 ${
                                index < 3 ? 'bg-neon-cyan/[0.03]' : 'hover:bg-white/[0.02]'
                              }`}
                            >
                              <TableCell>{getRankBadge(index)}</TableCell>
                              <TableCell>
                                <Badge className="bg-neon-red/10 text-neon-red border border-neon-red/20 font-bold">
                                  #{entry.competition_number}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-semibold">
                                <Link
                                  to={`/driver/${encodeURIComponent(entry.driver_name)}`}
                                  className="text-white hover:text-neon-cyan transition-colors"
                                >
                                  {entry.driver_name}
                                </Link>
                              </TableCell>
                              <TableCell className="text-gray-400">{entry.car}</TableCell>
                              <TableCell>
                                <Badge className="bg-white/5 text-gray-300 border border-white/10 text-xs">{entry.class_name}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-heading font-bold text-neon-cyan text-base">
                                {fmtTime(entry.best_time)}
                              </TableCell>
                              <TableCell className="text-right text-gray-400">
                                {fmtSpeed(entry.best_speed)}
                              </TableCell>
                              <TableCell className="text-gray-500 text-sm">
                                {entry.event_title || 'Unknown Event'}
                                <br />
                                <span className="text-xs text-gray-600">{entry.event_date || ''}</span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Stats Summary */}
              <div className="grid md:grid-cols-4 gap-4 mt-8">
                {[
                  { label: `Total Racers${selectedYear !== 'all' ? ` (${selectedYear})` : ''}`, value: filteredData.length, icon: Timer },
                  { label: `Fastest ${distanceLabel(distance)}`, value: fastestTime, icon: Zap },
                  { label: 'Top Speed', value: topSpeed, icon: Gauge },
                  { label: 'Average Time', value: avgTime, icon: Trophy },
                ].map((stat, i) => (
                  <Card key={i} className="glass-card">
                    <CardContent className="pt-5 pb-5 text-center">
                      <stat.icon size={18} className="mx-auto mb-2 text-neon-cyan" />
                      <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">{stat.label}</div>
                      <div className="text-2xl font-heading font-black text-neon-cyan">{stat.value}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}