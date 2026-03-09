import { useEffect, useState } from 'react';
import { client } from './client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, X, Trash2 } from 'lucide-react';

interface RaceTimesTabProps {
  raceTimes: any[];
  registrations: any[];
  events: any[];
  onReload: () => void;
}

export default function RaceTimesTab({ raceTimes, registrations, events, onReload }: RaceTimesTabProps) {
  const [raceTimeSearch, setRaceTimeSearch] = useState('');
  const [raceTimeEventFilter, setRaceTimeEventFilter] = useState<string>('all');
  const [raceTimeRoundFilter, setRaceTimeRoundFilter] = useState<string>('all');
  const [raceTimeWinFilter, setRaceTimeWinFilter] = useState<string>('all');
  const [raceTimeRedlightFilter, setRaceTimeRedlightFilter] = useState<string>('all');
  const [filteredRaceTimes, setFilteredRaceTimes] = useState<any[]>([]);

  const getRegistrationById = (regId: number) => registrations.find(r => r.id === regId);
  const getEventById = (eventId: number) => events.find(e => e.id === eventId);

  useEffect(() => {
    let filtered = raceTimes;

    if (raceTimeEventFilter !== 'all') {
      filtered = filtered.filter((t) => t.event_id === parseInt(raceTimeEventFilter));
    }

    if (raceTimeRoundFilter !== 'all') {
      filtered = filtered.filter((t) => t.round?.toLowerCase() === raceTimeRoundFilter.toLowerCase());
    }

    if (raceTimeWinFilter === 'win') {
      filtered = filtered.filter((t) => t.win === true);
    } else if (raceTimeWinFilter === 'loss') {
      filtered = filtered.filter((t) => t.win === false);
    }

    if (raceTimeRedlightFilter === 'yes') {
      filtered = filtered.filter((t) => t.redlight === true);
    } else if (raceTimeRedlightFilter === 'no') {
      filtered = filtered.filter((t) => t.redlight === false || t.redlight === null);
    }

    if (raceTimeSearch.trim() !== '') {
      const query = raceTimeSearch.toLowerCase();
      filtered = filtered.filter((t) => {
        const registration = getRegistrationById(t.registration_id);
        const event = getEventById(t.event_id);
        return (
          t.driver_name?.toLowerCase().includes(query) ||
          registration?.driver_name?.toLowerCase().includes(query) ||
          registration?.competition_number?.toString().includes(query) ||
          event?.title?.toLowerCase().includes(query) ||
          t.round?.toLowerCase().includes(query) ||
          t.lane?.toLowerCase().includes(query) ||
          t.notes?.toLowerCase().includes(query) ||
          t.quarter_mile_time?.toString().includes(query) ||
          t.reaction_time?.toString().includes(query)
        );
      });
    }

    setFilteredRaceTimes(filtered);
  }, [raceTimeSearch, raceTimeEventFilter, raceTimeRoundFilter, raceTimeWinFilter, raceTimeRedlightFilter, raceTimes, registrations, events]);

  const deleteRaceTime = async (timeId: number) => {
    if (!confirm('Are you sure you want to delete this race time record?')) return;

    try {
      await client.apiCall.invoke({
        url: `/api/v1/entities/race_times/${timeId}`,
        method: 'DELETE',
      });
      toast.success('Race time deleted successfully');
      onReload();
    } catch (error: any) {
      toast.error(error?.data?.detail || 'Failed to delete race time');
    }
  };

  const hasActiveFilters = raceTimeSearch || raceTimeEventFilter !== 'all' || raceTimeRoundFilter !== 'all' || raceTimeWinFilter !== 'all' || raceTimeRedlightFilter !== 'all';

  return (
    <Card className="bg-gray-900/70 border-gray-700">
      <CardHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">
              Race Times ({filteredRaceTimes.length}
              {filteredRaceTimes.length !== raceTimes.length && (
                <span className="text-gray-400 font-normal text-sm ml-1">of {raceTimes.length}</span>
              )})
            </CardTitle>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRaceTimeSearch('');
                  setRaceTimeEventFilter('all');
                  setRaceTimeRoundFilter('all');
                  setRaceTimeWinFilter('all');
                  setRaceTimeRedlightFilter('all');
                }}
                className="border-gray-600 text-gray-300 hover:bg-gray-800 gap-1"
              >
                <X className="w-3 h-3" />
                Clear Filters
              </Button>
            )}
          </div>

          {/* Search and Filters Row */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search driver, comp #, event, times..."
                value={raceTimeSearch}
                onChange={(e) => setRaceTimeSearch(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div className="w-48">
              <Select value={raceTimeEventFilter} onValueChange={setRaceTimeEventFilter}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="All Events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  {events.map((evt) => (
                    <SelectItem key={evt.id} value={evt.id.toString()}>
                      {evt.title} ({evt.date})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-40">
              <Select value={raceTimeRoundFilter} onValueChange={setRaceTimeRoundFilter}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="All Rounds" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rounds</SelectItem>
                  <SelectItem value="grudge">Grudge</SelectItem>
                  <SelectItem value="practice">Practice</SelectItem>
                  <SelectItem value="qualifying">Qualifying</SelectItem>
                  <SelectItem value="elimination">Elimination</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-32">
              <Select value={raceTimeWinFilter} onValueChange={setRaceTimeWinFilter}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Win/Loss" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Results</SelectItem>
                  <SelectItem value="win">Wins Only</SelectItem>
                  <SelectItem value="loss">Losses Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-36">
              <Select value={raceTimeRedlightFilter} onValueChange={setRaceTimeRedlightFilter}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Redlight" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="yes">Redlight Only</SelectItem>
                  <SelectItem value="no">No Redlight</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2">
              {raceTimeSearch && (
                <Badge variant="secondary" className="bg-blue-600/20 text-blue-300 gap-1">
                  Search: &quot;{raceTimeSearch}&quot;
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setRaceTimeSearch('')} />
                </Badge>
              )}
              {raceTimeEventFilter !== 'all' && (
                <Badge variant="secondary" className="bg-purple-600/20 text-purple-300 gap-1">
                  Event: {events.find(e => e.id === parseInt(raceTimeEventFilter))?.title || raceTimeEventFilter}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setRaceTimeEventFilter('all')} />
                </Badge>
              )}
              {raceTimeRoundFilter !== 'all' && (
                <Badge variant="secondary" className="bg-yellow-600/20 text-yellow-300 gap-1">
                  Round: {raceTimeRoundFilter}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setRaceTimeRoundFilter('all')} />
                </Badge>
              )}
              {raceTimeWinFilter !== 'all' && (
                <Badge variant="secondary" className="bg-green-600/20 text-green-300 gap-1">
                  {raceTimeWinFilter === 'win' ? 'Wins' : 'Losses'}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setRaceTimeWinFilter('all')} />
                </Badge>
              )}
              {raceTimeRedlightFilter !== 'all' && (
                <Badge variant="secondary" className="bg-red-600/20 text-red-300 gap-1">
                  {raceTimeRedlightFilter === 'yes' ? 'Redlights' : 'No Redlight'}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setRaceTimeRedlightFilter('all')} />
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-gray-200 font-semibold">Comp #</TableHead>
                <TableHead className="text-gray-200 font-semibold">Driver</TableHead>
                <TableHead className="text-gray-200 font-semibold">Event</TableHead>
                <TableHead className="text-gray-200 font-semibold">Round</TableHead>
                <TableHead className="text-gray-200 font-semibold">Lane</TableHead>
                <TableHead className="text-gray-200 font-semibold">Dial-in</TableHead>
                <TableHead className="text-gray-200 font-semibold">RT</TableHead>
                <TableHead className="text-gray-200 font-semibold">60ft</TableHead>
                <TableHead className="text-gray-200 font-semibold">330ft</TableHead>
                <TableHead className="text-gray-200 font-semibold">1/8 ET</TableHead>
                <TableHead className="text-gray-200 font-semibold">1/8 MPH</TableHead>
                <TableHead className="text-gray-200 font-semibold">1/4 ET</TableHead>
                <TableHead className="text-gray-200 font-semibold">1/4 MPH</TableHead>
                <TableHead className="text-gray-200 font-semibold">Redlight</TableHead>
                <TableHead className="text-gray-200 font-semibold">Breakout</TableHead>
                <TableHead className="text-gray-200 font-semibold">Win</TableHead>
                <TableHead className="text-gray-200 font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRaceTimes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={17} className="text-center text-gray-400 py-8">
                    {raceTimes.length === 0
                      ? 'No race times recorded yet.'
                      : 'No race times match your search criteria.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRaceTimes.map((time) => {
                  const registration = getRegistrationById(time.registration_id);
                  const event = getEventById(time.event_id);
                  return (
                    <TableRow key={time.id}>
                      <TableCell className="text-red-400 font-bold">
                        {registration?.competition_number || 'N/A'}
                      </TableCell>
                      <TableCell className="text-white font-medium">
                        {time.driver_name || registration?.driver_name || '-'}
                      </TableCell>
                      <TableCell className="text-gray-300 text-sm">
                        {event?.title || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-gray-300">{time.round || '-'}</TableCell>
                      <TableCell className="text-gray-300">{time.lane || '-'}</TableCell>
                      <TableCell className="text-gray-300">{time.dial_in?.toFixed(3) || '-'}</TableCell>
                      <TableCell className="text-gray-300">{time.reaction_time?.toFixed(3) || '-'}</TableCell>
                      <TableCell className="text-gray-300">{time.sixty_foot?.toFixed(3) || '-'}</TableCell>
                      <TableCell className="text-gray-300">{time.three_thirty_foot?.toFixed(3) || '-'}</TableCell>
                      <TableCell className="text-gray-300">{time.eighth_mile_time?.toFixed(3) || '-'}</TableCell>
                      <TableCell className="text-gray-300">{time.eighth_mile_speed?.toFixed(2) || '-'}</TableCell>
                      <TableCell className="text-red-400 font-bold">{time.quarter_mile_time?.toFixed(3) || '-'}</TableCell>
                      <TableCell className="text-gray-300">{time.quarter_mile_speed?.toFixed(2) || '-'}</TableCell>
                      <TableCell>
                        {time.redlight === true ? (
                          <Badge className="bg-red-600 text-white text-xs">Yes</Badge>
                        ) : time.redlight === false ? (
                          <span className="text-gray-500">No</span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {time.breakout === true ? (
                          <Badge className="bg-yellow-600 text-white text-xs">Yes</Badge>
                        ) : time.breakout === false ? (
                          <span className="text-gray-500">No</span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {time.win === true ? (
                          <Badge className="bg-green-600 text-white text-xs">Win</Badge>
                        ) : time.win === false ? (
                          <span className="text-gray-500">Loss</span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteRaceTime(time.id)}
                          className="gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
