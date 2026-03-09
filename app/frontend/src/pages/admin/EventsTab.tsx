import { useEffect, useState, useRef } from 'react';
import { client } from './client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Upload, Image, X, FileUp, CheckCircle2, AlertTriangle } from 'lucide-react';

interface EventsTabProps {
  events: any[];
  onReload: () => void;
}

export default function EventsTab({ events, onReload }: EventsTabProps) {
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [flyerUploading, setFlyerUploading] = useState(false);
  const [flyerPreviewUrl, setFlyerPreviewUrl] = useState<string | null>(null);
  const [pendingFlyerKey, setPendingFlyerKey] = useState<string | null>(null);
  const [flyerUrls, setFlyerUrls] = useState<Record<number, string>>({});
  const flyerInputRef = useRef<HTMLInputElement>(null);
  const editFlyerInputRef = useRef<HTMLInputElement>(null);
  const raceDataInputRef = useRef<HTMLInputElement>(null);
  const [isRaceDataDialogOpen, setIsRaceDataDialogOpen] = useState(false);
  const [raceDataEventId, setRaceDataEventId] = useState<number | null>(null);
  const [raceDataFile, setRaceDataFile] = useState<File | null>(null);
  const [raceDataType, setRaceDataType] = useState<string>('');
  const [raceDataContent, setRaceDataContent] = useState<string>('');
  const [raceDataUploading, setRaceDataUploading] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<any>(null);
  const [importStep, setImportStep] = useState<'select' | 'preview' | 'done'>('select');
  const [eventYearFilter, setEventYearFilter] = useState<string>(new Date().getFullYear().toString());
  const [filteredEvents, setFilteredEvents] = useState<any[]>([]);

  const [eventForm, setEventForm] = useState({
    title: '',
    date: '',
    location: '',
    start_time: '',
    end_time: '',
    buyin: '',
    payout: '',
    format: 'Heads-Up Racing',
    price: '$100',
    status: 'upcoming',
    notes: '',
  });

  const RACE_DATA_FILE_MAP: Record<string, string> = {
    'manual.dat': 'Grudge',
    'practice.dat': 'Practice',
    'qualify.dat': 'Qualifying',
    'elims.dat': 'Elimination',
  };
  const VALID_DAT_FILES = Object.keys(RACE_DATA_FILE_MAP);

  // Filter and sort events
  useEffect(() => {
    let filtered = [...events];

    if (eventYearFilter !== 'all') {
      filtered = filtered.filter((evt) => {
        const eventYear = new Date(evt.date).getFullYear().toString();
        return eventYear === eventYearFilter;
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    filtered.sort((a, b) => {
      const aIsUpcoming = a.status === 'upcoming';
      const bIsUpcoming = b.status === 'upcoming';

      if (aIsUpcoming && !bIsUpcoming) return -1;
      if (!aIsUpcoming && bIsUpcoming) return 1;

      if (aIsUpcoming && bIsUpcoming) {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }

      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    setFilteredEvents(filtered);
  }, [events, eventYearFilter]);

  const eventYears = Array.from(
    new Set(events.map((evt) => new Date(evt.date).getFullYear()))
  ).sort((a, b) => b - a);

  // Load flyer URLs — use flyer_url from DB or derive from flyer_key
  useEffect(() => {
    const urls: Record<number, string> = {};
    for (const evt of events) {
      if (evt.flyer_url) {
        urls[evt.id] = evt.flyer_url;
      } else if (evt.flyer_key) {
        // flyer_key is like "flyers/1234-filename.jpg", derive local URL
        const filename = evt.flyer_key.replace(/^flyers\//, '');
        urls[evt.id] = `/api/v1/flyers/file/${filename}`;
      }
    }
    setFlyerUrls(urls);
  }, [events]);

  // Flyer upload — saves to local server storage
  const handleFlyerUpload = async (file: File, isEdit: boolean = false) => {
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload an image (JPG, PNG, WebP, GIF) or PDF.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 10MB.');
      return;
    }

    setFlyerUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/v1/flyers/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Upload failed (${response.status})`);
      }

      const data = await response.json();
      setPendingFlyerKey(data.object_key);
      setFlyerPreviewUrl(data.url);

      toast.success('Flyer uploaded successfully!');
    } catch (error: any) {
      console.error('Flyer upload error:', error);
      toast.error(error.message || 'Failed to upload flyer. Please try again.');
    } finally {
      setFlyerUploading(false);
    }
  };

  const handleRemoveFlyer = () => {
    setPendingFlyerKey(null);
    setFlyerPreviewUrl(null);
    if (flyerInputRef.current) flyerInputRef.current.value = '';
    if (editFlyerInputRef.current) editFlyerInputRef.current.value = '';
  };

  // Flyer upload section component
  const FlyerUploadSection = ({ inputRef, isEdit }: { inputRef: React.RefObject<HTMLInputElement>; isEdit: boolean }) => (
    <div>
      <Label className="text-gray-200 font-medium">Event Flyer (Optional)</Label>
      <div className="mt-2">
        {flyerPreviewUrl ? (
          <div className="relative inline-block">
            <img
              src={flyerPreviewUrl}
              alt="Flyer preview"
              className="max-h-48 rounded border border-gray-600 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="hidden max-h-48 rounded border border-gray-600 bg-gray-800 p-4 flex items-center justify-center">
              <div className="text-center">
                <Image className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Flyer uploaded</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemoveFlyer}
              className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-red-500 transition-colors"
          >
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Click to upload a flyer image or PDF</p>
            <p className="text-gray-500 text-xs mt-1">JPG, PNG, WebP, GIF, or PDF • Max 10MB</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFlyerUpload(file, isEdit);
          }}
          disabled={flyerUploading}
        />
        {flyerUploading && (
          <div className="mt-2 flex items-center gap-2 text-yellow-400 text-sm">
            <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
            Uploading flyer...
          </div>
        )}
      </div>
    </div>
  );

  // Event form JSX (shared between create and edit)
  const EventFormFields = () => (
    <>
      <div>
        <Label className="text-gray-200 font-medium">Event Name *</Label>
        <Input
          required
          value={eventForm.title}
          onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
          placeholder="e.g., PDRL Summer Shootout"
          className="bg-gray-800 border-gray-700 text-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-gray-200 font-medium">Date of Event *</Label>
          <Input
            type="date"
            required
            value={eventForm.date}
            onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
            className="bg-gray-800 border-gray-700 text-white"
          />
        </div>
        <div>
          <Label className="text-gray-200 font-medium">Location *</Label>
          <Input
            required
            value={eventForm.location}
            onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
            placeholder="e.g., Bushy Park Circuit"
            className="bg-gray-800 border-gray-700 text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-gray-200 font-medium">Start Time *</Label>
          <Input
            type="time"
            required
            value={eventForm.start_time}
            onChange={(e) => setEventForm({ ...eventForm, start_time: e.target.value })}
            className="bg-gray-800 border-gray-700 text-white"
          />
        </div>
        <div>
          <Label className="text-gray-200 font-medium">End Time *</Label>
          <Input
            type="time"
            required
            value={eventForm.end_time}
            onChange={(e) => setEventForm({ ...eventForm, end_time: e.target.value })}
            className="bg-gray-800 border-gray-700 text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-gray-200 font-medium">Entry Fee</Label>
          <Input
            value={eventForm.price}
            onChange={(e) => setEventForm({ ...eventForm, price: e.target.value })}
            placeholder="e.g., $100"
            className="bg-gray-800 border-gray-700 text-white"
          />
        </div>
        <div>
          <Label className="text-gray-200 font-medium">Buy-in</Label>
          <Input
            value={eventForm.buyin}
            onChange={(e) => setEventForm({ ...eventForm, buyin: e.target.value })}
            placeholder="e.g., $50"
            className="bg-gray-800 border-gray-700 text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-gray-200 font-medium">Payout</Label>
          <Input
            value={eventForm.payout}
            onChange={(e) => setEventForm({ ...eventForm, payout: e.target.value })}
            placeholder="e.g., Winner takes all"
            className="bg-gray-800 border-gray-700 text-white"
          />
        </div>
        <div>
          <Label className="text-gray-200 font-medium">Format</Label>
          <Select value={eventForm.format} onValueChange={(value) => setEventForm({ ...eventForm, format: value })}>
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="Select format..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Heads-Up Racing">Heads-Up Racing</SelectItem>
              <SelectItem value="Index Racing">Index Racing</SelectItem>
              <SelectItem value="Bracket Racing (Handicap)">Bracket Racing (Handicap)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-gray-200 font-medium">Status</Label>
        <Select value={eventForm.status} onValueChange={(value) => setEventForm({ ...eventForm, status: value })}>
          <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-gray-200 font-medium">Notes (Optional)</Label>
        <Textarea
          value={eventForm.notes}
          onChange={(e) => setEventForm({ ...eventForm, notes: e.target.value })}
          placeholder="Additional event details..."
          className="bg-gray-800 border-gray-700 text-white"
          rows={3}
        />
      </div>
    </>
  );

  const resetEventForm = () => {
    setEventForm({
      title: '',
      date: '',
      location: '',
      start_time: '',
      end_time: '',
      buyin: '',
      payout: '',
      format: 'Heads-Up Racing',
      price: '$100',
      status: 'upcoming',
      notes: '',
    });
  };

  // Create event
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const createPayload = {
        title: eventForm.title,
        date: eventForm.date,
        location: eventForm.location,
        start_time: eventForm.start_time,
        end_time: eventForm.end_time,
        buyin: eventForm.buyin,
        payout: eventForm.payout,
        format: eventForm.format,
        price: eventForm.price,
        status: eventForm.status,
        notes: eventForm.notes,
        flyer_key: pendingFlyerKey || null,
        flyer_url: (pendingFlyerKey && flyerPreviewUrl) ? flyerPreviewUrl : null,
        created_at: new Date().toISOString(),
      };

      console.log('[Admin] Creating event with payload:', JSON.stringify(createPayload));

      await client.apiCall.invoke({
        url: '/api/v1/entities/events',
        method: 'POST',
        data: createPayload,
      });

      toast.success('Event created successfully');
      resetEventForm();
      handleRemoveFlyer();
      setIsEventDialogOpen(false);
      onReload();
    } catch (error: any) {
      console.error('[Admin] Create event error:', error);
      toast.error(error?.data?.detail || 'Failed to create event');
    }
  };

  // Edit event
  const handleEditEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;

    try {
      const updateData: any = {
        title: eventForm.title,
        date: eventForm.date,
        location: eventForm.location,
        start_time: eventForm.start_time,
        end_time: eventForm.end_time,
        buyin: eventForm.buyin,
        payout: eventForm.payout,
        format: eventForm.format,
        price: eventForm.price,
        status: eventForm.status,
        notes: eventForm.notes,
      };

      if (pendingFlyerKey !== null) {
        updateData.flyer_key = pendingFlyerKey;
        updateData.flyer_url = flyerPreviewUrl || null;
      }

      console.log('[Admin] Updating event', editingEvent.id, 'with payload:', JSON.stringify(updateData));

      await client.apiCall.invoke({
        url: `/api/v1/entities/events/${editingEvent.id}`,
        method: 'PUT',
        data: updateData,
      });

      toast.success('Event updated successfully');
      setIsEditDialogOpen(false);
      setEditingEvent(null);
      resetEventForm();
      handleRemoveFlyer();
      onReload();
    } catch (error: any) {
      console.error('[Admin] Update event error:', error);
      toast.error(error?.data?.detail || 'Failed to update event');
    }
  };

  const openEditDialog = async (evt: any) => {
    setEditingEvent(evt);
    setEventForm({
      title: evt.title || '',
      date: evt.date || '',
      location: evt.location || '',
      start_time: evt.start_time || '',
      end_time: evt.end_time || '',
      buyin: evt.buyin || '',
      payout: evt.payout || '',
      format: evt.format || 'Heads-Up Racing',
      price: evt.price || '$100',
      status: evt.status || 'upcoming',
      notes: evt.notes || '',
    });

    if (flyerUrls[evt.id]) {
      setFlyerPreviewUrl(flyerUrls[evt.id]);
      setPendingFlyerKey(null);
    } else if (evt.flyer_url) {
      setFlyerPreviewUrl(evt.flyer_url);
      setPendingFlyerKey(null);
    } else {
      setFlyerPreviewUrl(null);
      setPendingFlyerKey(null);
    }

    setIsEditDialogOpen(true);
  };

  const deleteEvent = async (eventId: number) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      await client.entities.events.delete({ id: eventId });
      toast.success('Event deleted successfully');
      onReload();
    } catch (error: any) {
      toast.error(error?.data?.detail || 'Failed to delete event');
    }
  };

  // Race data upload
  const openRaceDataDialog = (eventId: number) => {
    setRaceDataEventId(eventId);
    setRaceDataFile(null);
    setRaceDataType('');
    setRaceDataContent('');
    setIsRaceDataDialogOpen(true);
  };

  const handleRaceDataFileSelect = (file: File | null) => {
    if (!file) return;

    const fileName = file.name.toLowerCase();

    if (!fileName.endsWith('.dat')) {
      toast.error('Invalid file type. Only .dat files are accepted.');
      if (raceDataInputRef.current) raceDataInputRef.current.value = '';
      return;
    }

    if (!VALID_DAT_FILES.includes(fileName)) {
      toast.error(
        `Invalid file name "${file.name}". Accepted files: ${VALID_DAT_FILES.join(', ')}`
      );
      if (raceDataInputRef.current) raceDataInputRef.current.value = '';
      return;
    }

    const detectedType = RACE_DATA_FILE_MAP[fileName];
    setRaceDataFile(file);
    setRaceDataType(detectedType);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setRaceDataContent(content);
    };
    reader.readAsText(file);

    toast.success(`Detected race type: ${detectedType}`);
  };

  const handleRaceDataUpload = async () => {
    if (!raceDataFile || !raceDataEventId || !raceDataContent) {
      toast.error('Please select a valid .dat file first.');
      return;
    }

    setRaceDataUploading(true);
    try {
      if (importStep === 'select') {
        const parseRes = await client.apiCall.invoke({
          url: '/api/v1/race-data-import/parse-dat',
          method: 'POST',
          data: {
            content: raceDataContent,
            race_type: raceDataType,
          },
        });

        const parsed = parseRes.data;
        setParsedPreview(parsed);
        setImportStep('preview');

        if (parsed.debug_lines) {
          console.log('Parse Debug Lines:', parsed.debug_lines);
        }

        if (parsed.errors && parsed.errors.length > 0) {
          toast.warning(`Parsed ${parsed.parsed_count} rows with ${parsed.errors.length} warnings`);
        } else {
          toast.success(`Parsed ${parsed.parsed_count} rows successfully. Review and confirm import.`);
        }
      } else if (importStep === 'preview' && parsedPreview) {
        const importRes = await client.apiCall.invoke({
          url: '/api/v1/race-data-import/import',
          method: 'POST',
          data: {
            event_id: raceDataEventId,
            race_type: raceDataType,
            rows: parsedPreview.rows,
          },
        });

        const result = importRes.data;
        setParsedPreview((prev: any) => ({ ...prev, importResult: result }));
        setImportStep('done');

        if (result.duplicate_count > 0) {
          toast.info(`${result.duplicate_count} duplicate records were skipped`);
        }
        if (result.imported_count > 0) {
          toast.success(`${result.imported_count} records imported successfully`);
        } else if (result.duplicate_count > 0) {
          toast.warning('All records were duplicates — nothing new imported');
        } else {
          toast.warning(result.message);
        }

        if (result.errors && result.errors.length > 0) {
          result.errors.slice(0, 5).forEach((err: string) => toast.warning(err));
        }

        if (result.debug_info) {
          console.log('Import Debug Info:', JSON.stringify(result.debug_info, null, 2));
        }

        setTimeout(() => {
          setIsRaceDataDialogOpen(false);
          setRaceDataFile(null);
          setRaceDataType('');
          setRaceDataContent('');
          setParsedPreview(null);
          setImportStep('select');
          if (raceDataInputRef.current) raceDataInputRef.current.value = '';
          onReload();
        }, 1500);
      }
    } catch (error: any) {
      toast.error(error?.data?.detail || error?.message || 'Failed to process race data file');
    } finally {
      setRaceDataUploading(false);
    }
  };

  return (
    <>
      <Card className="bg-gray-900/70 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">
              Event Management ({filteredEvents.length}
              {filteredEvents.length !== events.length && (
                <span className="text-gray-400 font-normal text-sm ml-1">of {events.length}</span>
              )})
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="w-36">
                <Select value={eventYearFilter} onValueChange={setEventYearFilter}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Filter by year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {eventYears.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Dialog open={isEventDialogOpen} onOpenChange={(open) => {
                setIsEventDialogOpen(open);
                if (!open) handleRemoveFlyer();
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-red-600 hover:bg-red-700 font-semibold">
                    Create New Event
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-gray-900 border-gray-800 max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-white">Create New Racing Event</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateEvent} className="space-y-4">
                    <EventFormFields />
                    <FlyerUploadSection inputRef={flyerInputRef} isEdit={false} />
                    <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 font-semibold" disabled={flyerUploading}>
                      Create Event
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredEvents.map((evt) => (
              <div key={evt.id} className="p-4 bg-gray-800/50 rounded border border-gray-700">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-white">{evt.title}</h3>
                      {evt.flyer_key && (
                        <Badge variant="outline" className="text-green-400 border-green-400/50">
                          <Image className="w-3 h-3 mr-1" />
                          Flyer
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
                      <div><strong className="text-white">Date:</strong> {evt.date}</div>
                      <div><strong className="text-white">Location:</strong> {evt.location}</div>
                      <div><strong className="text-white">Start Time:</strong> {evt.start_time || 'N/A'}</div>
                      <div><strong className="text-white">End Time:</strong> {evt.end_time || 'N/A'}</div>
                      <div><strong className="text-white">Entry Fee:</strong> {evt.price}</div>
                      <div><strong className="text-white">Status:</strong> <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        evt.status === 'upcoming' ? 'bg-green-600' :
                        evt.status === 'completed' ? 'bg-blue-600' : 'bg-gray-600'
                      }`}>{evt.status}</span></div>
                    </div>
                    {evt.notes && (
                      <p className="text-sm text-gray-300 mt-2">{evt.notes}</p>
                    )}
                    {flyerUrls[evt.id] && (
                      <div className="mt-3">
                        <a href={flyerUrls[evt.id]} target="_blank" rel="noopener noreferrer">
                          <img
                            src={flyerUrls[evt.id]}
                            alt={`${evt.title} flyer`}
                            className="max-h-32 rounded border border-gray-600 object-contain hover:opacity-80 transition-opacity cursor-pointer"
                          />
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    <Button
                      size="sm"
                      onClick={() => openRaceDataDialog(evt.id)}
                      className="bg-green-600 hover:bg-green-700 font-semibold gap-1"
                    >
                      <FileUp className="w-4 h-4" />
                      Upload Race Data
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => openEditDialog(evt)}
                      className="bg-blue-600 hover:bg-blue-700 font-semibold"
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteEvent(evt.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {filteredEvents.length === 0 && (
              <p className="text-gray-300 text-center py-8">
                {events.length === 0
                  ? 'No events created yet. Click "Create New Event" to get started.'
                  : `No events found for ${eventYearFilter === 'all' ? 'any year' : eventYearFilter}. Try selecting a different year.`}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Event Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) handleRemoveFlyer();
      }}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Racing Event</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditEvent} className="space-y-4">
            <EventFormFields />
            <FlyerUploadSection inputRef={editFlyerInputRef} isEdit={true} />
            <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 font-semibold" disabled={flyerUploading}>
              Update Event
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload Race Data Dialog */}
      <Dialog open={isRaceDataDialogOpen} onOpenChange={(open) => {
        setIsRaceDataDialogOpen(open);
        if (!open) {
          setRaceDataFile(null);
          setRaceDataType('');
          setRaceDataContent('');
          setParsedPreview(null);
          setImportStep('select');
          if (raceDataInputRef.current) raceDataInputRef.current.value = '';
        }
      }}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FileUp className="w-5 h-5 text-green-400" />
              Upload Race Times Data
              {importStep === 'preview' && (
                <Badge className="bg-blue-600/20 text-blue-300 ml-2">Preview</Badge>
              )}
              {importStep === 'done' && (
                <Badge className="bg-green-600/20 text-green-300 ml-2">Complete</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {importStep === 'select' && (
              <>
                <div className="text-sm text-gray-300">
                  <p className="mb-2">Upload a <code className="bg-gray-800 px-1.5 py-0.5 rounded text-red-300">.dat</code> file to import race times for this event.</p>
                  <p className="font-semibold text-white mb-1">Accepted files:</p>
                  <ul className="space-y-1 ml-4">
                    <li className="flex items-center gap-2">
                      <span className="text-yellow-400 font-mono text-xs bg-gray-800 px-2 py-0.5 rounded">manual.dat</span>
                      <span className="text-gray-400">→</span>
                      <span>Grudge Races</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-yellow-400 font-mono text-xs bg-gray-800 px-2 py-0.5 rounded">practice.dat</span>
                      <span className="text-gray-400">→</span>
                      <span>Practice Races</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-yellow-400 font-mono text-xs bg-gray-800 px-2 py-0.5 rounded">qualify.dat</span>
                      <span className="text-gray-400">→</span>
                      <span>Qualifying Races</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-yellow-400 font-mono text-xs bg-gray-800 px-2 py-0.5 rounded">elims.dat</span>
                      <span className="text-gray-400">→</span>
                      <span>Elimination Races</span>
                    </li>
                  </ul>
                  <p className="mt-3 text-xs text-gray-400">
                    <strong>Format:</strong> Tab-delimited with columns: Date/Time, Class, Lane, Driver Name, 1/4 ET, 1/4 MPH, RT, Redlight, Dial-In, Breakout, 60ft, 330ft, 660ft, 1000ft, and more.
                  </p>
                </div>

                <div>
                  <div
                    onClick={() => raceDataInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-green-500 transition-colors"
                  >
                    {raceDataFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="w-8 h-8 text-green-400" />
                        <p className="text-white font-semibold">{raceDataFile.name}</p>
                        <Badge className="bg-green-600/20 text-green-300 font-semibold">
                          {raceDataType} Race Data
                        </Badge>
                        <p className="text-gray-400 text-xs">
                          {(raceDataFile.size / 1024).toFixed(1)} KB • Click to change file
                        </p>
                      </div>
                    ) : (
                      <div>
                        <FileUp className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-400 text-sm">Click to select a .dat file</p>
                        <p className="text-gray-500 text-xs mt-1">manual.dat, practice.dat, qualify.dat, or elims.dat</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={raceDataInputRef}
                    type="file"
                    accept=".dat"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      handleRaceDataFileSelect(file);
                    }}
                  />
                </div>

                {raceDataContent && (
                  <div>
                    <Label className="text-gray-200 font-medium mb-2 block">File Preview (first 500 chars)</Label>
                    <pre className="bg-gray-800 border border-gray-700 rounded p-3 text-xs text-gray-300 font-mono max-h-40 overflow-auto whitespace-pre-wrap">
                      {raceDataContent.substring(0, 500)}
                      {raceDataContent.length > 500 && '\n...'}
                    </pre>
                  </div>
                )}
              </>
            )}

            {importStep === 'preview' && parsedPreview && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-800/50 rounded p-3 text-center">
                    <p className="text-2xl font-bold text-green-400">{parsedPreview.parsed_count}</p>
                    <p className="text-xs text-gray-400">Rows Parsed</p>
                  </div>
                  <div className="bg-gray-800/50 rounded p-3 text-center">
                    <p className="text-2xl font-bold text-blue-400">{raceDataType}</p>
                    <p className="text-xs text-gray-400">Race Type</p>
                  </div>
                  <div className="bg-gray-800/50 rounded p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-400">{parsedPreview.errors?.length || 0}</p>
                    <p className="text-xs text-gray-400">Warnings</p>
                  </div>
                </div>

                {parsedPreview.errors && parsedPreview.errors.length > 0 && (
                  <div className="bg-yellow-900/20 border border-yellow-700 rounded p-3">
                    <p className="text-yellow-300 text-sm font-semibold mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      Parse Warnings:
                    </p>
                    <ul className="text-xs text-yellow-200 space-y-0.5 ml-5 list-disc">
                      {parsedPreview.errors.slice(0, 10).map((err: string, i: number) => (
                        <li key={i}>{err}</li>
                      ))}
                      {parsedPreview.errors.length > 10 && (
                        <li>...and {parsedPreview.errors.length - 10} more</li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <Label className="text-gray-200 font-medium mb-2 block">
                    Data Preview (first 10 rows of {parsedPreview.rows.length})
                  </Label>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-gray-200 text-xs">#</TableHead>
                        <TableHead className="text-gray-200 text-xs">Comp #</TableHead>
                        <TableHead className="text-gray-200 text-xs">Driver</TableHead>
                        <TableHead className="text-gray-200 text-xs">Class</TableHead>
                        <TableHead className="text-gray-200 text-xs">Lane</TableHead>
                        <TableHead className="text-gray-200 text-xs">Dial-In</TableHead>
                        <TableHead className="text-gray-200 text-xs">RT</TableHead>
                        <TableHead className="text-gray-200 text-xs">60ft</TableHead>
                        <TableHead className="text-gray-200 text-xs">330ft</TableHead>
                        <TableHead className="text-gray-200 text-xs">1/8 ET</TableHead>
                        <TableHead className="text-gray-200 text-xs">1/4 ET</TableHead>
                        <TableHead className="text-gray-200 text-xs">1/4 MPH</TableHead>
                        <TableHead className="text-gray-200 text-xs">Win</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedPreview.rows.slice(0, 10).map((row: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="text-gray-400 text-xs">{idx + 1}</TableCell>
                          <TableCell className="text-red-400 text-xs font-bold">{row.competition_number || '-'}</TableCell>
                          <TableCell className="text-white text-xs font-medium">{row.driver_name || '-'}</TableCell>
                          <TableCell className="text-gray-300 text-xs">{row.class_name || '-'}</TableCell>
                          <TableCell className="text-gray-300 text-xs">{row.lane || '-'}</TableCell>
                          <TableCell className="text-gray-300 text-xs">{row.dial_in?.toFixed(3) || '-'}</TableCell>
                          <TableCell className="text-gray-300 text-xs">{row.reaction_time?.toFixed(3) || '-'}</TableCell>
                          <TableCell className="text-gray-300 text-xs">{row.sixty_foot?.toFixed(3) || '-'}</TableCell>
                          <TableCell className="text-gray-300 text-xs">{row.three_thirty_foot?.toFixed(3) || '-'}</TableCell>
                          <TableCell className="text-gray-300 text-xs">{row.eighth_mile_time?.toFixed(3) || '-'}</TableCell>
                          <TableCell className="text-red-400 text-xs font-bold">{row.quarter_mile_time?.toFixed(3) || '-'}</TableCell>
                          <TableCell className="text-gray-300 text-xs">{row.quarter_mile_speed?.toFixed(2) || '-'}</TableCell>
                          <TableCell className="text-xs">
                            {row.win === true ? (
                              <Badge className="bg-green-600 text-white text-xs">Win</Badge>
                            ) : row.win === false ? (
                              <span className="text-gray-500">Loss</span>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}

            {importStep === 'done' && parsedPreview?.importResult && (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <p className="text-xl font-bold text-white mb-2">Import Complete!</p>
                  <p className="text-gray-400">{parsedPreview.importResult.message}</p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-green-900/20 border border-green-700 rounded p-3 text-center">
                    <p className="text-2xl font-bold text-green-400">{parsedPreview.importResult.imported_count}</p>
                    <p className="text-xs text-gray-400">Imported</p>
                  </div>
                  <div className="bg-yellow-900/20 border border-yellow-700 rounded p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-400">{parsedPreview.importResult.duplicate_count}</p>
                    <p className="text-xs text-gray-400">Duplicates Skipped</p>
                  </div>
                  <div className="bg-red-900/20 border border-red-700 rounded p-3 text-center">
                    <p className="text-2xl font-bold text-red-400">{parsedPreview.importResult.skipped_count}</p>
                    <p className="text-xs text-gray-400">Errors</p>
                  </div>
                </div>

                {parsedPreview.importResult.debug_info && (
                  <div className="bg-gray-800/50 rounded p-3 border border-gray-700">
                    <p className="text-sm font-semibold text-white mb-2">Import Details:</p>
                    <div className="text-xs text-gray-300 space-y-1">
                      <p>Rows received: {parsedPreview.importResult.debug_info.total_rows_received}</p>
                      <p>Existing race times: {parsedPreview.importResult.debug_info.existing_race_times}</p>
                      <p>Existing fingerprints: {parsedPreview.importResult.debug_info.existing_fingerprints_count}</p>
                      <p>Records prepared: {parsedPreview.importResult.debug_info.records_to_insert}</p>
                      <p>Batch insert: {parsedPreview.importResult.debug_info.batch_insert || 'N/A'}</p>
                    </div>
                    {parsedPreview.importResult.debug_info.row_details && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-white mb-1">Row Status:</p>
                        <div className="space-y-0.5">
                          {parsedPreview.importResult.debug_info.row_details.map((rd: any, i: number) => (
                            <p key={i} className={`text-xs ${rd.status === 'duplicate' ? 'text-yellow-400' : rd.status === 'prepared' ? 'text-green-400' : 'text-red-400'}`}>
                              Row {rd.index}: {rd.driver_name || 'Unknown'} — {rd.status}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {parsedPreview.importResult.errors && parsedPreview.importResult.errors.length > 0 && (
                  <div className="bg-red-900/20 border border-red-700 rounded p-3">
                    <p className="text-sm font-semibold text-red-300 mb-1">Errors:</p>
                    <ul className="text-xs text-red-200 space-y-0.5 ml-4 list-disc">
                      {parsedPreview.importResult.errors.map((err: string, i: number) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {importStep === 'done' && !parsedPreview?.importResult && (
              <div className="text-center py-8">
                <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <p className="text-xl font-bold text-white mb-2">Import Complete!</p>
                <p className="text-gray-400">Race times have been processed.</p>
              </div>
            )}

            {importStep !== 'done' && (
              <div className="flex gap-3">
                {importStep === 'preview' && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setImportStep('select');
                      setParsedPreview(null);
                    }}
                    className="border-gray-600 text-gray-300 hover:bg-gray-800"
                  >
                    Back
                  </Button>
                )}
                <Button
                  onClick={handleRaceDataUpload}
                  disabled={!raceDataFile || raceDataUploading}
                  className={`flex-1 font-semibold gap-2 ${
                    importStep === 'preview'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {raceDataUploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {importStep === 'preview' ? 'Importing...' : 'Parsing...'}
                    </>
                  ) : importStep === 'preview' ? (
                    <>
                      <Upload className="w-4 h-4" />
                      Confirm Import ({parsedPreview?.parsed_count} rows)
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Parse & Preview
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsRaceDataDialogOpen(false)}
                  className="border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
