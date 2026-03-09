import { useState } from 'react';
import { client } from './client';
import type { AdminUser } from './client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Shield, UserPlus, Trash2, AlertTriangle } from 'lucide-react';

interface AdminManagementTabProps {
  admins: AdminUser[];
  currentAdminStatus: any;
  isSuperAdmin: boolean;
  onReload: () => void;
}

export default function AdminManagementTab({ admins, currentAdminStatus, isSuperAdmin, onReload }: AdminManagementTabProps) {
  const [isAddAdminDialogOpen, setIsAddAdminDialogOpen] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'admin' | 'super_admin'>('admin');

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
      onReload();
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
      onReload();
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
      onReload();
    } catch (error: any) {
      toast.error(error?.data?.detail || 'Failed to update role');
    }
  };

  return (
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
  );
}
