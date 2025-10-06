import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Trash2, Plus, CheckCircle, XCircle, Clock, Pencil } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { z } from 'zod';
import { formatDistanceToNow } from 'date-fns';

const createUserSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: 'Please enter a valid email address' })
    .max(255, { message: 'Email must be less than 255 characters' }),
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters for security' })
    .max(128, { message: 'Password must be less than 128 characters' })
    .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
    .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
    .regex(/[0-9]/, { message: 'Password must contain at least one number' }),
  username: z
    .string()
    .trim()
    .min(3, { message: 'Username must be at least 3 characters' })
    .max(50, { message: 'Username must be less than 50 characters' })
    .regex(/^[a-zA-Z0-9_-]+$/, { message: 'Username can only contain letters, numbers, hyphens, and underscores' }),
  name: z
    .string()
    .trim()
    .min(1, { message: 'Name is required' })
    .max(100, { message: 'Name must be less than 100 characters' }),
  department: z
    .string()
    .trim()
    .min(1, { message: 'Department is required' })
    .max(100, { message: 'Department must be less than 100 characters' })
});

interface Profile {
  id: string;
  email: string;
  username: string;
  name: string;
  department: string;
}

interface UserRole {
  user_id: string;
  role: string;
}

interface DepartmentVisibility {
  id: string;
  user_id: string;
  department: string;
}

interface AccessRequest {
  id: string;
  user_id: string;
  requested_at: string;
  status: 'pending' | 'approved' | 'denied';
  approved_by: string | null;
  approved_at: string | null;
  expires_at: string | null;
}

interface ActivityLog {
  id: string;
  user_id: string;
  customer_id: string | null;
  action: 'created' | 'updated' | 'deleted';
  changes: any;
  created_at: string;
}

export default function Admin() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<Profile[]>([]);
  const [visibilities, setVisibilities] = useState<DepartmentVisibility[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [grantAdmin, setGrantAdmin] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedNavSection, setSelectedNavSection] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editDepartment, setEditDepartment] = useState('');

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/');
    }
  }, [isAdmin, loading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
      loadVisibilities();
      loadUserRoles();
      loadAccessRequests();
      loadActivityLogs();
    }
  }, [isAdmin]);

  const loadUsers = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      toast.error('Not authenticated');
      return;
    }

    const { data, error } = await supabase.functions.invoke('list-users', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      toast.error('Failed to load users');
      console.error(error);
    } else {
      setUsers(data?.users || []);
    }
  };

  const loadVisibilities = async () => {
    const { data, error } = await supabase
      .from('department_visibility')
      .select('*');

    if (error) {
      toast.error('Failed to load department visibilities');
      console.error(error);
    } else {
      setVisibilities(data || []);
    }
  };

  const loadUserRoles = async () => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('user_id, role');

    if (error) {
      console.error('Failed to load user roles:', error);
    } else {
      setUserRoles(data || []);
    }
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const username = formData.get('username') as string;
    const name = formData.get('name') as string;
    const department = selectedDepartment;

    // Validate input
    const validation = createUserSchema.safeParse({ 
      email, 
      password, 
      username, 
      name, 
      department 
    });
    
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError.message);
      setSubmitting(false);
      return;
    }

    // Create user via edge function
    const { data: { session } } = await supabase.auth.getSession();

    const { data, error } = await supabase.functions.invoke('create-user', {
      headers: {
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: {
        email: validation.data.email,
        password: validation.data.password,
        username: validation.data.username,
        name: validation.data.name,
        department: validation.data.department,
        grantAdmin,
      },
    });

    if (error) {
      toast.error(error.message || 'Failed to create user');
      setSubmitting(false);
      return;
    }

    if (data?.error) {
      toast.error(data.error);
      setSubmitting(false);
      return;
    }

    toast.success('User created successfully');
    e.currentTarget.reset();
    setGrantAdmin(false);
    setSelectedDepartment('');
    loadUsers();
    loadUserRoles();
    setSubmitting(false);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    const { data: { session } } = await supabase.auth.getSession();

    const { data, error } = await supabase.functions.invoke('delete-user', {
      headers: {
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: { userId },
    });

    if (error) {
      toast.error(error.message || 'Failed to delete user');
      console.error(error);
      return;
    }

    if (data?.error) {
      toast.error(data.error);
      console.error(data.error);
    } else {
      toast.success('User deleted successfully');
      loadUsers();
      loadUserRoles();
    }
  };

  const handleAddVisibility = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    if (!selectedUserId) {
      toast.error('Please select a user');
      setSubmitting(false);
      return;
    }

    if (!selectedNavSection) {
      toast.error('Please select a navigation section');
      setSubmitting(false);
      return;
    }

    const { error } = await supabase
      .from('department_visibility')
      .insert({ user_id: selectedUserId, department: selectedNavSection });

    if (error) {
      toast.error('Failed to add navigation access');
      console.error(error);
    } else {
      toast.success('Navigation access granted');
      setSelectedUserId('');
      setSelectedNavSection('');
      loadVisibilities();
    }

    setSubmitting(false);
  };

  const handleRemoveVisibility = async (id: string) => {
    const { error } = await supabase
      .from('department_visibility')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to remove department visibility');
      console.error(error);
    } else {
      toast.success('Department visibility removed');
      loadVisibilities();
    }
  };

  const loadAccessRequests = async () => {
    const { data, error } = await supabase
      .from('access_requests')
      .select('*')
      .order('requested_at', { ascending: false });

    if (error) {
      console.error('Failed to load access requests:', error);
    } else {
      setAccessRequests((data || []) as AccessRequest[]);
    }
  };

  const loadActivityLogs = async () => {
    const { data, error } = await supabase
      .from('customer_activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Failed to load activity logs:', error);
    } else {
      setActivityLogs((data || []) as ActivityLog[]);
    }
  };

  const handleApproveRequest = async (requestId: string, userId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Set expiration to 4 PM today
    const today = new Date();
    const expiresAt = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 0, 0);
    
    // If it's already past 4 PM, set for tomorrow
    if (new Date() > expiresAt) {
      expiresAt.setDate(expiresAt.getDate() + 1);
    }

    const { error } = await supabase
      .from('access_requests')
      .update({
        status: 'approved',
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', requestId);

    if (error) {
      toast.error('Failed to approve request');
      console.error(error);
    } else {
      toast.success('Access request approved until 4 PM');
      loadAccessRequests();
    }
  };

  const handleDenyRequest = async (requestId: string) => {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('access_requests')
      .update({
        status: 'denied',
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) {
      toast.error('Failed to deny request');
      console.error(error);
    } else {
      toast.success('Access request denied');
      loadAccessRequests();
    }
  };

  const handleEditUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser) return;
    
    setSubmitting(true);

    const updates: { username?: string; password?: string; department?: string } = {};
    
    if (editUsername && editUsername !== editingUser.username) {
      updates.username = editUsername;
    }
    
    if (editPassword) {
      updates.password = editPassword;
    }

    if (editDepartment && editDepartment !== editingUser.department) {
      updates.department = editDepartment;
    }

    if (Object.keys(updates).length === 0) {
      toast.error('No changes to save');
      setSubmitting(false);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();

    const { data, error } = await supabase.functions.invoke('update-user', {
      headers: {
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: {
        userId: editingUser.id,
        ...updates,
      },
    });

    if (error) {
      toast.error(error.message || 'Failed to update user');
      setSubmitting(false);
      return;
    }

    if (data?.error) {
      toast.error(data.error);
      setSubmitting(false);
      return;
    }

    toast.success('User updated successfully');
    setEditingUser(null);
    setEditUsername('');
    setEditPassword('');
    setEditDepartment('');
    loadUsers();
    setSubmitting(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>

      <Dialog open={!!editingUser} onOpenChange={(open) => {
        if (!open) {
          setEditingUser(null);
          setEditUsername('');
          setEditPassword('');
          setEditDepartment('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update username, department, and/or password for {editingUser?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                placeholder="Enter new username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-department">Department</Label>
              <Select value={editDepartment} onValueChange={setEditDepartment}>
                <SelectTrigger id="edit-department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="finance department">Finance Department</SelectItem>
                  <SelectItem value="executive department">Executive Department</SelectItem>
                  <SelectItem value="procurement & logistics department">Procurement & Logistics Department</SelectItem>
                  <SelectItem value="divisional">Divisional</SelectItem>
                  <SelectItem value="operational divisions">Operational Divisions</SelectItem>
                  <SelectItem value="contract department">Contract Department</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">New Password (optional)</Label>
              <PasswordInput
                id="edit-password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Leave blank to keep current password"
              />
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters with uppercase, lowercase, and number
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingUser(null);
                  setEditUsername('');
                  setEditPassword('');
                  setEditDepartment('');
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="visibility">Department Visibility</TabsTrigger>
          <TabsTrigger value="access">Access Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create New User</CardTitle>
              <CardDescription>Add a new user to the system</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <PasswordInput id="password" name="password" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input id="username" name="username" type="text" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" name="name" type="text" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Select value={selectedDepartment} onValueChange={setSelectedDepartment} required>
                      <SelectTrigger id="department">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sales">Sales</SelectItem>
                        <SelectItem value="finance department">Finance Department</SelectItem>
                        <SelectItem value="executive department">Executive Department</SelectItem>
                        <SelectItem value="procurement & logistics department">Procurement & Logistics Department</SelectItem>
                        <SelectItem value="divisional">Divisional</SelectItem>
                        <SelectItem value="operational divisions">Operational Divisions</SelectItem>
                        <SelectItem value="contract department">Contract Department</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2 pt-8">
                    <Checkbox 
                      id="grantAdmin" 
                      checked={grantAdmin}
                      onCheckedChange={(checked) => setGrantAdmin(checked === true)}
                    />
                    <Label htmlFor="grantAdmin" className="cursor-pointer">
                      Grant admin privileges
                    </Label>
                  </div>
                </div>
                <Button type="submit" disabled={submitting}>
                  <Plus className="w-4 h-4 mr-2" />
                  {submitting ? 'Creating...' : 'Create User'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const isUserAdmin = userRoles.some(
                      (role) => role.user_id === user.id && role.role === 'admin'
                    );
                    return (
                      <TableRow key={user.id}>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.name}</TableCell>
                        <TableCell className="capitalize">{user.department}</TableCell>
                        <TableCell>
                          {isUserAdmin ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary text-primary-foreground">
                              Admin
                            </span>
                          ) : (
                            <span className="text-muted-foreground">User</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingUser(user);
                                setEditUsername(user.username);
                                setEditPassword('');
                                setEditDepartment(user.department);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteUser(user.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visibility" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Navigation Access Control</CardTitle>
              <CardDescription>Control which navigation sections users can access</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddVisibility} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="user_id">User</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId} required>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a user" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border border-border z-50">
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name} ({user.username})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nav-section">Navigation Section</Label>
                    <Select value={selectedNavSection} onValueChange={setSelectedNavSection} required>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select navigation section" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border border-border z-50">
                        <SelectItem value="Dashboard">Dashboard</SelectItem>
                        <SelectItem value="Sales">Sales</SelectItem>
                        <SelectItem value="Customers">Customers</SelectItem>
                        <SelectItem value="Products">Products</SelectItem>
                        <SelectItem value="Contracts">Contracts</SelectItem>
                        <SelectItem value="Fulfillment">Fulfillment</SelectItem>
                        <SelectItem value="Finance">Finance (All)</SelectItem>
                        <SelectItem value="Finance-Overview">Finance - Overview</SelectItem>
                        <SelectItem value="Finance-Income">Finance - Income</SelectItem>
                        <SelectItem value="Finance-Expenditure">Finance - Expenditure</SelectItem>
                        <SelectItem value="Finance-Invoices">Finance - Invoices</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" disabled={submitting}>
                  <Plus className="w-4 h-4 mr-2" />
                  {submitting ? 'Adding...' : 'Grant Access'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>User Navigation Access</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Navigation Section</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibilities.map((vis) => {
                    const user = users.find((u) => u.id === vis.user_id);
                    return (
                      <TableRow key={vis.id}>
                        <TableCell>{user?.name || 'Unknown'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{vis.department}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoveVisibility(vis.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Access Requests</CardTitle>
              <CardDescription>Review and approve access requests from sales team</CardDescription>
            </CardHeader>
            <CardContent>
              {accessRequests.filter(req => req.status === 'pending').length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accessRequests
                      .filter(req => req.status === 'pending')
                      .map((request) => {
                        const user = users.find((u) => u.id === request.user_id);
                        return (
                          <TableRow key={request.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{user?.name || 'Unknown'}</p>
                                <p className="text-sm text-muted-foreground">{user?.department}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {formatDistanceToNow(new Date(request.requested_at), { addSuffix: true })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                <Clock className="w-3 h-3 mr-1" />
                                Pending
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleApproveRequest(request.id, request.user_id)}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDenyRequest(request.id)}
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Deny
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-4">No pending access requests</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active & Past Access Grants</CardTitle>
              <CardDescription>View all approved and expired access grants</CardDescription>
            </CardHeader>
            <CardContent>
              {accessRequests.filter(req => req.status === 'approved').length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Approved By</TableHead>
                      <TableHead>Expires At</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accessRequests
                      .filter(req => req.status === 'approved')
                      .map((request) => {
                        const user = users.find((u) => u.id === request.user_id);
                        const approver = users.find((u) => u.id === request.approved_by);
                        const isExpired = request.expires_at && new Date(request.expires_at) < new Date();
                        
                        return (
                          <TableRow key={request.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{user?.name || 'Unknown'}</p>
                                <p className="text-sm text-muted-foreground">{user?.department}</p>
                              </div>
                            </TableCell>
                            <TableCell>{approver?.name || 'Unknown'}</TableCell>
                            <TableCell>
                              {request.expires_at 
                                ? new Date(request.expires_at).toLocaleString()
                                : 'N/A'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={isExpired ? 'secondary' : 'default'}>
                                {isExpired ? 'Expired' : 'Active'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-4">No approved access requests</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Changes made by users with temporary access</CardDescription>
            </CardHeader>
            <CardContent>
              {activityLogs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityLogs.slice(0, 20).map((log) => {
                      const user = users.find((u) => u.id === log.user_id);
                      return (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{user?.name || 'Unknown'}</p>
                              <p className="text-sm text-muted-foreground">{user?.department}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              log.action === 'created' ? 'default' :
                              log.action === 'updated' ? 'secondary' :
                              'destructive'
                            }>
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            Customer ID: {log.customer_id?.slice(0, 8)}...
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-4">No activity recorded yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
