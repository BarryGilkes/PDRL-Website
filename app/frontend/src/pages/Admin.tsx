import { useEffect, useState, useRef } from 'react';
import { createClient } from '@metagptx/web-sdk';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Shield, UserPlus, Trash2, Settings, AlertTriangle, Edit, Search, Upload, Image, X, FileUp, CheckCircle2 } from 'lucide-react';

const client = createClient();
const FLYER_BUCKET = 'event-flyers';

interface Admin {
  id: number;
  email: string;
  role: 'admin' | 'super_admin';
  created_at: string;
}

export default function Admin() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [filteredRegistrations, setFilteredRegistrations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string>('all');
  const [raceTimes, setRaceTimes] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [currentAdminStatus, setCurrentAdminStatus] = useState<any>(null);
  const [selectedReg, setSelectedReg] = useState<any>(null);
  const [editingReg, setEditingReg] = useState<any>(null);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEditRegDialogOpen, setIsEditRegDialogOpen] = useState(false);
  const [isAddAdminDialogOpen, setIsAddAdminDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'admin' | 'super_admin'>('admin');
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
  // Race Times search/filter state
  const [raceTimeSearch, setRaceTimeSearch] = useState('');
  const [raceTimeEventFilter, setRaceTimeEventFilter] = useState<string>('all');
  const [raceTimeRoundFilter, setRaceTimeRoundFilter] = useState<string>('all');
  const [raceTimeWinFilter, setRaceTimeWinFilter] = useState<string>('all');
  const [raceTimeRedlightFilter, setRaceTimeRedlightFilter] = useState<string>('all');
  const [filteredRaceTimes, setFilteredRaceTimes] = useState<any[]>([]);
  const [eventYearFilter, setEventYearFilter] = useState<string>(new Date().getFullYear().toString());
  const [filteredEvents, setFilteredEvents] = useState<any[]>([]);

  const [timeForm, setTimeForm] = useState({
    round: '',
    sixty_foot: '',
    three_thirty_foot: '',
    eighth_mile_time: '',
    eighth_mile_speed: '',
    quarter_mile_time: '',
    quarter_mile_speed: '',
    reaction_time: '',
    notes: '',
  });
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
  const [regForm, setRegForm] = useState({
    driver_name: '',
    phone: '',
    email: '',
    class_name: '',
    car: '',
    competition_number: '',
    payment_status: 'pending',
  });

  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const userRes = await client.auth.me();
        if (userRes?.data?.id) {
          setUser(userRes.data);
          await checkAdminStatus();
          loadData();
        } else {
          setAuthError('not_logged_in');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setAuthError('not_logged_in');
      } finally {
        setAuthLoading(false);
      }
    };
    init();
  }, []);

  const handleLogin = async () => {
    try {
      await client.auth.toLogin();
    } catch (error) {
      console.error('Login redirect failed:', error);
      toast.error('Failed to redirect to login page');
    }
  };

  useEffect(() => {
    // Filter registrations based on search query and selected event
    let filtered = registrations;

    // Filter by event
    if (selectedEventId !== 'all') {
      filtered = filtered.filter((reg) => reg.event_id === parseInt(selectedEventId));
    }

    // Filter by search query
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((reg) => {
        return (
          reg.driver_name?.toLowerCase().includes(query) ||
          reg.phone?.toLowerCase().includes(query) ||
          reg.email?.toLowerCase().includes(query) ||
          reg.class_name?.toLowerCase().includes(query) ||
          reg.car?.toLowerCase().includes(query) ||
          reg.competition_number?.toString().includes(query)
        );
      });
    }

    setFilteredRegistrations(filtered);
  }, [searchQuery, selectedEventId, registrations]);

  // Filter race times based on search and filters
  useEffect(() => {
    let filtered = raceTimes;

    // Filter by event
    if (raceTimeEventFilter !== 'all') {
      filtered = filtered.filter((t) => t.event_id === parseInt(raceTimeEventFilter));
    }

    // Filter by round
    if (raceTimeRoundFilter !== 'all') {
      filtered = filtered.filter((t) => t.round?.toLowerCase() === raceTimeRoundFilter.toLowerCase());
    }

    // Filter by win status
    if (raceTimeWinFilter === 'win') {
      filtered = filtered.filter((t) => t.win === true);
    } else if (raceTimeWinFilter === 'loss') {
      filtered = filtered.filter((t) => t.win === false);
    }

    // Filter by redlight
    if (raceTimeRedlightFilter === 'yes') {
      filtered = filtered.filter((t) => t.redlight === true);
    } else if (raceTimeRedlightFilter === 'no') {
      filtered = filtered.filter((t) => t.redlight === false || t.redlight === null);
    }

    // Text search
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

  // Filter and sort events: upcoming (closest date first) at top, then completed (most recent first)
  useEffect(() => {
    let filtered = [...events];

    // Filter by year
    if (eventYearFilter !== 'all') {
      filtered = filtered.filter((evt) => {
        const eventYear = new Date(evt.date).getFullYear().toString();
        return eventYear === eventYearFilter;
      });
    }

    // Sort: upcoming events first (closest date at top), then completed/cancelled (most recent first)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    filtered.sort((a, b) => {
      const aIsUpcoming = a.status === 'upcoming';
      const bIsUpcoming = b.status === 'upcoming';

      // Upcoming events come before non-upcoming
      if (aIsUpcoming && !bIsUpcoming) return -1;
      if (!aIsUpcoming && bIsUpcoming) return 1;

      if (aIsUpcoming && bIsUpcoming) {
        // Among upcoming: sort ascending (closest date first)
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }

      // Among completed/cancelled: sort descending (most recent first)
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    setFilteredEvents(filtered);
  }, [events, eventYearFilter]);

  // Get unique years from events for the dropdown
  const eventYears = Array.from(
    new Set(events.map((evt) => new Date(evt.date).getFullYear()))
  ).sort((a, b) => b - a);

  // Helper: strip presigned query params from a URL to get permanent public URL
  const toPublicUrl = (url: string): string => {
    try {
      const parsed = new URL(url);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return url;
    }
  };

  // Load flyer URLs for events - prefer flyer_url from DB, fallback to resolving flyer_key
  useEffect(() => {
    const loadFlyerUrls = async () => {
      const urls: Record<number, string> = {};
      for (const evt of events) {
        // First check if flyer_url is already stored in the DB
        if (evt.flyer_url) {
          urls[evt.id] = toPublicUrl(evt.flyer_url);
        } else if (evt.flyer_key) {
          try {
            const res = await client.storage.getDownloadUrl({
              bucket_name: FLYER_BUCKET,
              object_key: evt.flyer_key,
            });
            if (res?.data?.download_url) {
              // Strip presigned params for permanent public URL
              urls[evt.id] = toPublicUrl(res.data.download_url);
            }
          } catch (err) {
            console.error(`Failed to get flyer URL for event ${evt.id}:`, err);
          }
        }
      }
      setFlyerUrls(urls);
    };

    if (events.length > 0) {
      loadFlyerUrls();
    }
  }, [events]);

  const checkAdminStatus = async () => {
    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/admin/check',
        method: 'GET',
      });
      setCurrentAdminStatus(response.data);
    } catch (error: any) {
      console.error('Error checking admin status:', error);
    }
  };

  const loadData = async () => {
    // Load registrations - try auth endpoint first, fallback to public
    try {
      const regsRes = await client.apiCall.invoke({
        url: '/api/v1/registrations/all',
        method: 'GET',
        data: { skip: 0, limit: 500 },
      });
      setRegistrations(regsRes.data.items || []);
    } catch (error: any) {
      console.warn('Failed to load registrations via /all, trying public endpoint:', error?.data?.detail || error?.message);
      try {
        const regsRes = await client.apiCall.invoke({
          url: '/api/v1/registrations/public',
          method: 'GET',
          data: { skip: 0, limit: 500 },
        });
        setRegistrations(regsRes.data.items || []);
      } catch (fallbackError: any) {
        console.error('Failed to load registrations from both endpoints:', fallbackError);
      }
    }

    // Load race times - try entity query first, fallback to /all endpoint
    try {
      const timesRes = await client.entities.race_times.query({
        query: {},
        limit: 1000,
      });
      setRaceTimes(timesRes.data.items || []);
    } catch (error: any) {
      console.warn('Failed to load race times via entity query, trying /all endpoint:', error?.data?.detail || error?.message);
      try {
        const timesRes = await client.apiCall.invoke({
          url: '/api/v1/entities/race_times/all',
          method: 'GET',
          data: { skip: 0, limit: 1000 },
        });
        setRaceTimes(timesRes.data.items || []);
      } catch (fallbackError: any) {
        console.error('Failed to load race times from both endpoints:', fallbackError);
      }
    }

    // Load events
    try {
      const eventsRes = await client.entities.events.query({ limit: 50, sort: '-created_at' });
      setEvents(eventsRes.data.items || []);
    } catch (error: any) {
      console.warn('Failed to load events via entity query, trying /all endpoint:', error?.data?.detail || error?.message);
      try {
        const eventsRes = await client.apiCall.invoke({
          url: '/api/v1/entities/events/all',
          method: 'GET',
          data: { skip: 0, limit: 50 },
        });
        setEvents(eventsRes.data.items || []);
      } catch (fallbackError: any) {
        console.error('Failed to load events from both endpoints:', fallbackError);
      }
    }

    // Load admins list
    try {
      await loadAdmins();
    } catch (error: any) {
      console.error('Failed to load admins:', error);
    }
  };

  const loadAdmins = async () => {
    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/admin/list',
        method: 'GET',
      });
      setAdmins(response.data.admins || []);
    } catch (error: any) {
      console.error('Error loading admins:', error);
      toast.error(error?.data?.detail || 'Failed to load admins');
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await client.apiCall.invoke({
        url: '/api/v1/admin/add',
        method: 'POST',
        data: {
          email: newAdminEmail,
          role: newAdminRole,
        },
      });

      toast.success('Admin added successfully');
      setNewAdminEmail('');
      setNewAdminRole('admin');
      setIsAddAdminDialogOpen(false);
      loadAdmins();
    } catch (error: any) {
      toast.error(error?.data?.detail || 'Failed to add admin');
    }
  };

  const handleRemoveAdmin = async (adminId: number, adminEmail: string) => {
    if (!confirm(`Are you sure you want to remove admin: ${adminEmail}?`)) return;

    try {
      await client.apiCall.invoke({
        url: `/api/v1/admin/${adminId}`,
        method: 'DELETE',
      });

      toast.success('Admin removed successfully');
      loadAdmins();
    } catch (error: any) {
      toast.error(error?.data?.detail || 'Failed to remove admin');
    }
  };

  const handleUpdateRole = async (adminId: number, newRole: 'admin' | 'super_admin') => {
    try {
      await client.apiCall.invoke({
        url: `/api/v1/admin/${adminId}/role`,
        method: 'PUT',
        data: { role: newRole },
      });

      toast.success('Admin role updated successfully');
      loadAdmins();
    } catch (error: any) {
      toast.error(error?.data?.detail || 'Failed to update role');
    }
  };

  const handleFixCompetitionNumbers = async () => {
    if (!confirm('This will fix all null competition numbers in the database. Continue?')) return;

    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/maintenance/fix-competition-numbers',
        method: 'POST',
      });

      toast.success(response.data.message || 'Competition numbers fixed successfully');
      loadData();
    } catch (error: any) {
      toast.error(error?.data?.detail || 'Failed to fix competition numbers');
    }
  };

  // Upload flyer to ObjectStorage
  const handleFlyerUpload = async (file: File, isEdit: boolean = false) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload an image (JPG, PNG, WebP, GIF) or PDF.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 10MB.');
      return;
    }

    setFlyerUploading(true);
    try {
      const timestamp = Date.now();
      const ext = file.name.split('.').pop() || 'jpg';
      const objectKey = `flyers/${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

      await client.storage.upload({
        bucket_name: FLYER_BUCKET,
        object_key: objectKey,
        file: file,
      });

      setPendingFlyerKey(objectKey);

      // Get the download URL and strip presigned params for a permanent public URL
      // (bucket is public, so the base URL without signatures works permanently)
      try {
        const dlRes = await client.storage.getDownloadUrl({
          bucket_name: FLYER_BUCKET,
          object_key: objectKey,
        });
        if (dlRes?.data?.download_url) {
          // Strip presigned query params to get permanent public URL
          const url = new URL(dlRes.data.download_url);
          const publicUrl = `${url.origin}${url.pathname}`;
          setFlyerPreviewUrl(publicUrl);
        } else {
          setFlyerPreviewUrl(URL.createObjectURL(file));
        }
      } catch {
        setFlyerPreviewUrl(URL.createObjectURL(file));
      }

      toast.success('Flyer uploaded successfully!');
    } catch (error: any) {
      console.error('Flyer upload error:', error);
      toast.error('Failed to upload flyer. Please try again.');
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

  // Race data file type mapping
  const RACE_DATA_FILE_MAP: Record<string, string> = {
    'manual.dat': 'Grudge',
    'practice.dat': 'Practice',
    'qualify.dat': 'Qualifying',
    'elims.dat': 'Elimination',
  };

  const VALID_DAT_FILES = Object.keys(RACE_DATA_FILE_MAP);

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

    // Validate file extension
    if (!fileName.endsWith('.dat')) {
      toast.error('Invalid file type. Only .dat files are accepted.');
      if (raceDataInputRef.current) raceDataInputRef.current.value = '';
      return;
    }

    // Validate file name
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

    // Read file content
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setRaceDataContent(content);
    };
    reader.readAsText(file);

    toast.success(`Detected race type: ${detectedType}`);
  };

  const [parsedPreview, setParsedPreview] = useState<any>(null);
  const [importStep, setImportStep] = useState<'select' | 'preview' | 'done'>('select');

  const handleRaceDataUpload = async () => {
    if (!raceDataFile || !raceDataEventId || !raceDataContent) {
      toast.error('Please select a valid .dat file first.');
      return;
    }

    setRaceDataUploading(true);
    try {
      if (importStep === 'select') {
        // Step 1: Parse the file and show preview
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

        // Log debug info
        if (parsed.debug_lines) {
          console.log('Parse Debug Lines:', parsed.debug_lines);
        }

        if (parsed.errors && parsed.errors.length > 0) {
          toast.warning(`Parsed ${parsed.parsed_count} rows with ${parsed.errors.length} warnings`);
        } else {
          toast.success(`Parsed ${parsed.parsed_count} rows successfully. Review and confirm import.`);
        }
      } else if (importStep === 'preview' && parsedPreview) {
        // Step 2: Import the parsed data
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
        
        // Show detailed import results
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

        // Log debug info to console for troubleshooting
        if (result.debug_info) {
          console.log('Import Debug Info:', JSON.stringify(result.debug_info, null, 2));
        }

        // Reload data and close dialog after a short delay
        setTimeout(() => {
          setIsRaceDataDialogOpen(false);
          setRaceDataFile(null);
          setRaceDataType('');
          setRaceDataContent('');
          setParsedPreview(null);
          setImportStep('select');
          if (raceDataInputRef.current) raceDataInputRef.current.value = '';
          loadData();
        }, 1500);
      }
    } catch (error: any) {
      toast.error(error?.data?.detail || error?.message || 'Failed to process race data file');
    } finally {
      setRaceDataUploading(false);
    }
  };

  const handleRecordTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReg) return;

    try {
      await client.entities.race_times.create({
        data: {
          registration_id: selectedReg.id,
          event_id: selectedReg.event_id,
          round: timeForm.round,
          sixty_foot: timeForm.sixty_foot ? parseFloat(timeForm.sixty_foot) : null,
          three_thirty_foot: timeForm.three_thirty_foot ? parseFloat(timeForm.three_thirty_foot) : null,
          eighth_mile_time: timeForm.eighth_mile_time ? parseFloat(timeForm.eighth_mile_time) : null,
          eighth_mile_speed: timeForm.eighth_mile_speed ? parseFloat(timeForm.eighth_mile_speed) : null,
          quarter_mile_time: timeForm.quarter_mile_time ? parseFloat(timeForm.quarter_mile_time) : null,
          quarter_mile_speed: timeForm.quarter_mile_speed ? parseFloat(timeForm.quarter_mile_speed) : null,
          reaction_time: timeForm.reaction_time ? parseFloat(timeForm.reaction_time) : null,
          notes: timeForm.notes,
          recorded_at: new Date().toISOString(),
        },
      });

      toast.success('Race time recorded successfully');
      setTimeForm({
        round: '',
        sixty_foot: '',
        three_thirty_foot: '',
        eighth_mile_time: '',
        eighth_mile_speed: '',
        quarter_mile_time: '',
        quarter_mile_speed: '',
        reaction_time: '',
        notes: '',
      });
      setSelectedReg(null);
      loadData();
    } catch (error: any) {
      toast.error(error?.data?.detail || 'Failed to record time');
    }
  };

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

      // Use apiCall.invoke instead of SDK entity to ensure flyer_key/flyer_url is transmitted
      await client.apiCall.invoke({
        url: '/api/v1/entities/events',
        method: 'POST',
        data: createPayload,
      });

      toast.success('Event created successfully');
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
      handleRemoveFlyer();
      setIsEventDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error('[Admin] Create event error:', error);
      toast.error(error?.data?.detail || 'Failed to create event');
    }
  };

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

      // Only update flyer_key/flyer_url if a new flyer was uploaded
      if (pendingFlyerKey !== null) {
        updateData.flyer_key = pendingFlyerKey;
        updateData.flyer_url = flyerPreviewUrl || null;
      }

      console.log('[Admin] Updating event', editingEvent.id, 'with payload:', JSON.stringify(updateData));

      // Use apiCall.invoke instead of SDK entity to ensure flyer_key/flyer_url is transmitted
      await client.apiCall.invoke({
        url: `/api/v1/entities/events/${editingEvent.id}`,
        method: 'PUT',
        data: updateData,
      });

      toast.success('Event updated successfully');
      setIsEditDialogOpen(false);
      setEditingEvent(null);
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
      handleRemoveFlyer();
      loadData();
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

    // Load existing flyer preview - prefer flyerUrls map, fallback to evt.flyer_url
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

  const openEditRegDialog = (reg: any) => {
    setEditingReg(reg);
    setRegForm({
      driver_name: reg.driver_name || '',
      phone: reg.phone || '',
      email: reg.email || '',
      class_name: reg.class_name || '',
      car: reg.car || '',
      competition_number: reg.competition_number?.toString() || '',
      payment_status: reg.payment_status || 'pending',
    });
    setIsEditRegDialogOpen(true);
  };

  const handleEditRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReg) return;

    try {
      await client.apiCall.invoke({
        url: `/api/v1/registrations/${editingReg.id}`,
        method: 'PUT',
        data: {
          driver_name: regForm.driver_name,
          phone: regForm.phone,
          email: regForm.email,
          class_name: regForm.class_name,
          car: regForm.car,
          competition_number: regForm.competition_number ? parseInt(regForm.competition_number) : null,
          payment_status: regForm.payment_status,
        },
      });

      toast.success('Registration updated successfully');
      setIsEditRegDialogOpen(false);
      setEditingReg(null);
      setRegForm({
        driver_name: '',
        phone: '',
        email: '',
        class_name: '',
        car: '',
        competition_number: '',
        payment_status: 'pending',
      });
      loadData();
    } catch (error: any) {
      toast.error(error?.data?.detail || 'Failed to update registration');
    }
  };

  const updatePaymentStatus = async (regId: number, status: string) => {
    try {
      await client.apiCall.invoke({
        url: `/api/v1/registrations/${regId}`,
        method: 'PUT',
        data: { payment_status: status },
      });
      toast.success('Payment status updated');
      loadData();
    } catch (error: any) {
      toast.error(error?.data?.detail || 'Failed to update status');
    }
  };

  const deleteEvent = async (eventId: number) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      await client.entities.events.delete({ id: eventId });
      toast.success('Event deleted successfully');
      loadData();
    } catch (error: any) {
      toast.error(error?.data?.detail || 'Failed to delete event');
    }
  };

  const deleteRaceTime = async (timeId: number) => {
    if (!confirm('Are you sure you want to delete this race time record?')) return;

    try {
      await client.apiCall.invoke({
        url: `/api/v1/entities/race_times/${timeId}`,
        method: 'DELETE',
      });
      toast.success('Race time deleted successfully');
      loadData();
    } catch (error: any) {
      toast.error(error?.data?.detail || 'Failed to delete race time');
    }
  };

  // Helper function to get registration by ID
  const getRegistrationById = (regId: number) => {
    return registrations.find(r => r.id === regId);
  };

  // Helper function to get event by ID
  const getEventById = (eventId: number) => {
    return events.find(e => e.id === eventId);
  };

  // Helper function to get the next upcoming event (closest to current date)
  const getNextUpcomingEvent = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingEvents = events
      .filter((evt) => {
        const eventDate = new Date(evt.date);
        eventDate.setHours(0, 0, 0, 0);
        return evt.status === 'upcoming' && eventDate >= today;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return upcomingEvents.length > 0 ? upcomingEvents[0] : null;
  };

  // Get the registration table title based on the next upcoming event
  const getRegistrationTableTitle = () => {
    const nextEvent = getNextUpcomingEvent();
    if (nextEvent) {
      return `${nextEvent.title} - Registrations`;
    }
    return 'All Registrations';
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
                // If image fails to load (e.g., PDF), show a placeholder
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

  // Show loading spinner while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 mb-4">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (authError || !user) {
    return (
      <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-white">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Card className="bg-gray-900/70 border-gray-700 max-w-md w-full mx-4">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-[#00d4ff]/10 flex items-center justify-center mx-auto mb-6">
                <Shield size={32} className="text-[#00d4ff]" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Admin Access Required</h2>
              <p className="text-gray-400 mb-6">
                You must be logged in with an authorized admin account to access the administration panel.
              </p>
              <Button
                onClick={handleLogin}
                className="bg-gradient-to-r from-neon-cyan to-cyan-600 text-dark-900 font-extrabold text-base px-8 py-6 rounded-xl hover:shadow-[0_0_30px_rgba(0,212,255,0.4)] transition-all duration-300 hover:scale-105 w-full"
              >
                <Shield size={18} className="mr-2" />
                Log In to Continue
              </Button>
              <p className="text-gray-500 text-xs mt-4">
                Only authorized administrators can access this page.
              </p>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const isSuperAdmin = currentAdminStatus?.role === 'super_admin';

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-white">
      <Header />
      
      <main className="flex-1 py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#00d4ff]/10 border border-[#00d4ff]/20 rounded-full px-4 py-2 mb-3">
                <Shield size={14} className="text-[#00d4ff]" />
                <span className="text-sm text-[#00d4ff] font-semibold">Administration</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">ADMIN <span className="text-[#00d4ff]">PANEL</span></h1>
            </div>
            {currentAdminStatus && (
              <Badge variant={isSuperAdmin ? "default" : "secondary"} className="text-sm px-3 py-1 bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/20">
                <Shield className="w-4 h-4 mr-1" />
                {currentAdminStatus.role === 'super_admin' ? 'Super Admin' : 'Admin'}
              </Badge>
            )}
          </div>

          <Tabs defaultValue="registrations" className="space-y-6">
            <TabsList className="bg-[#0f1118] border border-white/5">
              <TabsTrigger value="registrations">Registrations</TabsTrigger>
              <TabsTrigger value="times">Race Times</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
              <TabsTrigger value="admins">
                <Shield className="w-4 h-4 mr-2" />
                Admin Management
              </TabsTrigger>
              <TabsTrigger value="maintenance">
                <Settings className="w-4 h-4 mr-2" />
                Maintenance
              </TabsTrigger>
            </TabsList>

            <TabsContent value="registrations">
              <Card className="bg-gray-900/70 border-gray-700">
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle className="text-white">{getRegistrationTableTitle()} ({filteredRegistrations.length})</CardTitle>
                    <div className="flex gap-4">
                      <div className="w-48">
                        <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                          <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                            <SelectValue placeholder="Filter by event..." />
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
                      <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          type="text"
                          placeholder="Search registrations..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 bg-gray-800 border-gray-700 text-white"
                        />
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-gray-200 font-semibold">Event</TableHead>
                          <TableHead className="text-gray-200 font-semibold">Driver</TableHead>
                          <TableHead className="text-gray-200 font-semibold">Comp #</TableHead>
                          <TableHead className="text-gray-200 font-semibold">Phone</TableHead>
                          <TableHead className="text-gray-200 font-semibold">Class</TableHead>
                          <TableHead className="text-gray-200 font-semibold">Car</TableHead>
                          <TableHead className="text-gray-200 font-semibold">Payment</TableHead>
                          <TableHead className="text-gray-200 font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRegistrations.map((reg) => {
                          const event = getEventById(reg.event_id);
                          return (
                            <TableRow key={reg.id}>
                              <TableCell className="text-gray-300 font-medium">
                                {event ? `${event.title}` : 'Unknown Event'}
                                <div className="text-xs text-gray-500">{event?.date}</div>
                              </TableCell>
                              <TableCell className="text-white font-medium">{reg.driver_name}</TableCell>
                              <TableCell className="text-red-400 font-bold">{reg.competition_number || 'N/A'}</TableCell>
                              <TableCell className="text-gray-300">{reg.phone}</TableCell>
                              <TableCell className="text-gray-300">{reg.class_name}</TableCell>
                              <TableCell className="text-gray-300">{reg.car}</TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  reg.payment_status === 'confirmed' ? 'bg-green-600' :
                                  reg.payment_status === 'pending' ? 'bg-yellow-600' : 'bg-gray-600'
                                }`}>
                                  {reg.payment_status}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => openEditRegDialog(reg)}
                                    className="bg-blue-600 hover:bg-blue-700 font-semibold"
                                  >
                                    <Edit className="w-4 h-4 mr-1" />
                                    Edit
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => updatePaymentStatus(reg.id, 'confirmed')}
                                    className="bg-green-600 hover:bg-green-700 font-semibold"
                                  >
                                    Confirm
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="times">
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
                      {(raceTimeSearch || raceTimeEventFilter !== 'all' || raceTimeRoundFilter !== 'all' || raceTimeWinFilter !== 'all' || raceTimeRedlightFilter !== 'all') && (
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
                      {/* Text Search */}
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

                      {/* Event Filter */}
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

                      {/* Round Filter */}
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

                      {/* Win Filter */}
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

                      {/* Redlight Filter */}
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
                    {(raceTimeSearch || raceTimeEventFilter !== 'all' || raceTimeRoundFilter !== 'all' || raceTimeWinFilter !== 'all' || raceTimeRedlightFilter !== 'all') && (
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
            </TabsContent>

            <TabsContent value="events">
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
                            {/* Flyer thumbnail */}
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
            </TabsContent>

            <TabsContent value="admins">
              <Card className="bg-gray-900/70 border-gray-700">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      Admin Management ({admins.length})
                    </CardTitle>
                    {isSuperAdmin && (
                      <Dialog open={isAddAdminDialogOpen} onOpenChange={setIsAddAdminDialogOpen}>
                        <DialogTrigger asChild>
                          <Button className="bg-blue-600 hover:bg-blue-700 font-semibold">
                            <UserPlus className="w-4 h-4 mr-2" />
                            Add Admin
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-gray-900 border-gray-800">
                          <DialogHeader>
                            <DialogTitle className="text-white">Add New Administrator</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={handleAddAdmin} className="space-y-4">
                            <div>
                              <Label className="text-gray-200 font-medium">Email Address *</Label>
                              <Input
                                type="email"
                                required
                                value={newAdminEmail}
                                onChange={(e) => setNewAdminEmail(e.target.value)}
                                placeholder="admin@pdrl.club"
                                className="bg-gray-800 border-gray-700 text-white"
                              />
                            </div>

                            <div>
                              <Label className="text-gray-200 font-medium">Role *</Label>
                              <Select value={newAdminRole} onValueChange={(value: 'admin' | 'super_admin') => setNewAdminRole(value)}>
                                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="super_admin">Super Admin</SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-gray-400 mt-1">
                                Super admins can manage other admins. Regular admins can only manage events and registrations.
                              </p>
                            </div>

                            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 font-semibold">
                              Add Administrator
                            </Button>
                          </form>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-gray-200 font-semibold">Email</TableHead>
                          <TableHead className="text-gray-200 font-semibold">Role</TableHead>
                          <TableHead className="text-gray-200 font-semibold">Created At</TableHead>
                          {isSuperAdmin && <TableHead className="text-gray-200 font-semibold">Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {admins.map((admin) => (
                          <TableRow key={admin.id}>
                            <TableCell className="text-white font-medium">{admin.email}</TableCell>
                            <TableCell>
                              {isSuperAdmin ? (
                                <Select 
                                  value={admin.role} 
                                  onValueChange={(value: 'admin' | 'super_admin') => handleUpdateRole(admin.id, value)}
                                >
                                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white w-40">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="super_admin">Super Admin</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge variant={admin.role === 'super_admin' ? "default" : "secondary"}>
                                  {admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-gray-300">
                              {new Date(admin.created_at).toLocaleDateString()}
                            </TableCell>
                            {isSuperAdmin && (
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleRemoveAdmin(admin.id, admin.email)}
                                  disabled={admin.email === currentAdminStatus?.email}
                                >
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Remove
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {!isSuperAdmin && (
                    <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-700 rounded">
                      <p className="text-yellow-200 text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        You need Super Admin privileges to add or remove administrators.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="maintenance">
              <Card className="bg-gray-900/70 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Maintenance Tools
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-gray-800/50 rounded border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-2">Fix Competition Numbers</h3>
                    <p className="text-gray-300 text-sm mb-4">
                      This tool will automatically assign competition numbers to any registrations that have null values.
                      It generates unique numbers based on existing registrations.
                    </p>
                    <Button
                      onClick={handleFixCompetitionNumbers}
                      className="bg-orange-600 hover:bg-orange-700 font-semibold"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Run Fix
                    </Button>
                  </div>

                  <div className="p-4 bg-gray-800/50 rounded border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-2">Add New Race Times Fields</h3>
                    <p className="text-gray-300 text-sm mb-4">
                      Run this migration to add the new fields to the race_times table: Date/Time Stamp, Lane, Redlight, Dial-in, Driver Name, Breakout, and Win.
                      This is safe to run multiple times — existing columns will be skipped.
                    </p>
                    <Button
                      onClick={async () => {
                        try {
                          const res = await client.apiCall.invoke({
                            url: '/api/v1/migration/add-race-times-fields',
                            method: 'POST',
                          });
                          toast.success(
                            `Migration complete! Added: ${res.data.columns_added?.join(', ') || 'none'}. Skipped: ${res.data.columns_skipped?.join(', ') || 'none'}.`
                          );
                        } catch (error: any) {
                          toast.error(error?.data?.detail || 'Migration failed');
                        }
                      }}
                      className="bg-purple-600 hover:bg-purple-700 font-semibold"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Run Migration
                    </Button>
                  </div>

                  <div className="p-4 bg-blue-900/20 border border-blue-700 rounded">
                    <h3 className="text-lg font-semibold text-white mb-2">Database Statistics</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Total Registrations</p>
                        <p className="text-2xl font-bold text-white">{registrations.length}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Total Race Times</p>
                        <p className="text-2xl font-bold text-white">{raceTimes.length}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Total Events</p>
                        <p className="text-2xl font-bold text-white">{events.length}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Total Admins</p>
                        <p className="text-2xl font-bold text-white">{admins.length}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

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

            <FlyerUploadSection inputRef={editFlyerInputRef} isEdit={true} />

            <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 font-semibold" disabled={flyerUploading}>
              Update Event
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Registration Dialog */}
      <Dialog open={isEditRegDialogOpen} onOpenChange={setIsEditRegDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Registration</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditRegistration} className="space-y-4">
            <div>
              <Label className="text-gray-200 font-medium">Driver Name *</Label>
              <Input
                required
                value={regForm.driver_name}
                onChange={(e) => setRegForm({ ...regForm, driver_name: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-200 font-medium">Phone *</Label>
                <Input
                  required
                  value={regForm.phone}
                  onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-200 font-medium">Email *</Label>
                <Input
                  type="email"
                  required
                  value={regForm.email}
                  onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-200 font-medium">Class *</Label>
                <Select value={regForm.class_name} onValueChange={(value) => setRegForm({ ...regForm, class_name: value })}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="True Street">True Street</SelectItem>
                    <SelectItem value="Street Mod">Street Mod</SelectItem>
                    <SelectItem value="Pro Street">Pro Street</SelectItem>
                    <SelectItem value="Pro">Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-200 font-medium">Competition Number</Label>
                <Input
                  type="number"
                  value={regForm.competition_number}
                  onChange={(e) => setRegForm({ ...regForm, competition_number: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            <div>
              <Label className="text-gray-200 font-medium">Car *</Label>
              <Input
                required
                value={regForm.car}
                onChange={(e) => setRegForm({ ...regForm, car: e.target.value })}
                placeholder="e.g., 2015 Honda Civic"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div>
              <Label className="text-gray-200 font-medium">Payment Status</Label>
              <Select value={regForm.payment_status} onValueChange={(value) => setRegForm({ ...regForm, payment_status: value })}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 font-semibold">
              Update Registration
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

                {/* File selector */}
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

                {/* File content preview */}
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
                {/* Summary */}
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

                {/* Errors/Warnings */}
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

                {/* Data preview table */}
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

                {/* Import Summary */}
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

                {/* Debug Info */}
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

                {/* Errors */}
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

            {/* Action buttons */}
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

      <Footer />
    </div>
  );
}