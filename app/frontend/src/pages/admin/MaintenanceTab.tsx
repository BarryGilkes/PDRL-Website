import { client } from './client';
import type { AdminUser } from './client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Settings } from 'lucide-react';

interface MaintenanceTabProps {
  registrations: any[];
  raceTimes: any[];
  events: any[];
  admins: AdminUser[];
  onReload: () => void;
}

export default function MaintenanceTab({ registrations, raceTimes, events, admins, onReload }: MaintenanceTabProps) {
  const handleFixCompetitionNumbers = async () => {
    if (!confirm('This will fix all null competition numbers in the database. Continue?')) return;

    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/maintenance/fix-competition-numbers',
        method: 'POST',
      });

      toast.success(response.data.message || 'Competition numbers fixed successfully');
      onReload();
    } catch (error: any) {
      toast.error(error?.data?.detail || 'Failed to fix competition numbers');
    }
  };

  const handleRunMigration = async () => {
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
  };

  return (
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
            onClick={handleRunMigration}
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
  );
}
