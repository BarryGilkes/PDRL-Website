import { useEffect, useState } from 'react';
import { client } from './client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Edit, Search } from 'lucide-react';

interface RegistrationsTabProps {
  registrations: any[];
  events: any[];
  onReload: () => void;
}

export default function RegistrationsTab({ registrations, events, onReload }: RegistrationsTabProps) {
  const [filteredRegistrations, setFilteredRegistrations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string>('all');
  const [isEditRegDialogOpen, setIsEditRegDialogOpen] = useState(false);
  const [editingReg, setEditingReg] = useState<any>(null);
  const [regForm, setRegForm] = useState({
    driver_name: '',
    phone: '',
    email: '',
    class_name: '',
    car: '',
    competition_number: '',
    payment_status: 'pending',
  });

  useEffect(() => {
    let filtered = registrations;

    if (selectedEventId !== 'all') {
      filtered = filtered.filter((reg) => reg.event_id === parseInt(selectedEventId));
    }

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

  const getEventById = (eventId: number) => events.find(e => e.id === eventId);

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

  const getRegistrationTableTitle = () => {
    const nextEvent = getNextUpcomingEvent();
    if (nextEvent) {
      return `${nextEvent.title} - Registrations`;
    }
    return 'All Registrations';
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
      onReload();
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
      onReload();
    } catch (error: any) {
      toast.error(error?.data?.detail || 'Failed to update status');
    }
  };

  return (
    <>
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
    </>
  );
}
