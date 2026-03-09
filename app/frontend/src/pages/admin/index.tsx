import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Shield, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { client } from './client';
import type { AdminUser } from './client';
import RegistrationsTab from './RegistrationsTab';
import RaceTimesTab from './RaceTimesTab';
import EventsTab from './EventsTab';
import AdminManagementTab from './AdminManagementTab';
import MaintenanceTab from './MaintenanceTab';

export default function Admin() {
  const [user, setUser] = useState<any>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [raceTimes, setRaceTimes] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [currentAdminStatus, setCurrentAdminStatus] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const userRes = await client.auth.me();
        if (userRes?.data?.id) {
          setUser(userRes.data);
          // Check if user is in the admin database
          const adminRes = await client.apiCall.invoke({
            url: '/api/v1/admin/check',
            method: 'GET',
          });
          setCurrentAdminStatus(adminRes.data);
          if (!adminRes.data?.is_admin) {
            setAuthError('not_admin');
          } else {
            loadData();
          }
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

  const loadData = async () => {
    // Load registrations
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

    // Load race times
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

    // Load admins
    try {
      await loadAdmins();
    } catch (error: any) {
      console.error('Failed to load admins:', error);
    }
  };

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
  if (authError === 'not_logged_in' || !user) {
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

  // Show not authorized if logged in but not in admin database
  if (authError === 'not_admin') {
    return (
      <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-white">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Card className="bg-gray-900/70 border-gray-700 max-w-md w-full mx-4">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                <Shield size={32} className="text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Access Denied</h2>
              <p className="text-gray-400 mb-6">
                Your account is not authorized to access the administration panel. Contact a super admin to request access.
              </p>
              <p className="text-gray-500 text-xs">
                Logged in as: {user?.email || 'Unknown'}
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
              <RegistrationsTab
                registrations={registrations}
                events={events}
                onReload={loadData}
              />
            </TabsContent>

            <TabsContent value="times">
              <RaceTimesTab
                raceTimes={raceTimes}
                registrations={registrations}
                events={events}
                onReload={loadData}
              />
            </TabsContent>

            <TabsContent value="events">
              <EventsTab
                events={events}
                onReload={loadData}
              />
            </TabsContent>

            <TabsContent value="admins">
              <AdminManagementTab
                admins={admins}
                currentAdminStatus={currentAdminStatus}
                isSuperAdmin={isSuperAdmin}
                onReload={loadAdmins}
              />
            </TabsContent>

            <TabsContent value="maintenance">
              <MaintenanceTab
                registrations={registrations}
                raceTimes={raceTimes}
                events={events}
                admins={admins}
                onReload={loadData}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
}
