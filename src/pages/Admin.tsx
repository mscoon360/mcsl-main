import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Trash2, Plus } from 'lucide-react';

interface Profile {
  id: string;
  username: string;
  name: string;
  department: string;
}

interface DepartmentVisibility {
  id: string;
  user_id: string;
  department: string;
}

export default function Admin() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<Profile[]>([]);
  const [visibilities, setVisibilities] = useState<DepartmentVisibility[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/');
    }
  }, [isAdmin, loading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
      loadVisibilities();
    }
  }, [isAdmin]);

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load users');
      console.error(error);
    } else {
      setUsers(data || []);
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

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const username = formData.get('username') as string;
    const name = formData.get('name') as string;
    const department = formData.get('department') as string;

    // Create user via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        name,
        department,
      },
    });

    if (authError) {
      toast.error(authError.message);
      setSubmitting(false);
      return;
    }

    toast.success('User created successfully');
    e.currentTarget.reset();
    loadUsers();
    setSubmitting(false);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
      toast.error('Failed to delete user');
      console.error(error);
    } else {
      toast.success('User deleted successfully');
      loadUsers();
    }
  };

  const handleAddVisibility = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const userId = formData.get('user_id') as string;
    const department = formData.get('department') as string;

    const { error } = await supabase
      .from('department_visibility')
      .insert({ user_id: userId, department });

    if (error) {
      toast.error('Failed to add department visibility');
      console.error(error);
    } else {
      toast.success('Department visibility added');
      e.currentTarget.reset();
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

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="visibility">Department Visibility</TabsTrigger>
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
                    <Input id="password" name="password" type="password" required />
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
                    <Input id="department" name="department" type="text" required />
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
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.department}</TableCell>
                      <TableCell>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visibility" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add Department Visibility</CardTitle>
              <CardDescription>Control which departments users can access</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddVisibility} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="user_id">User</Label>
                    <select
                      id="user_id"
                      name="user_id"
                      required
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="">Select a user</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.username})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vis-department">Department</Label>
                    <Input id="vis-department" name="department" type="text" required />
                  </div>
                </div>
                <Button type="submit" disabled={submitting}>
                  <Plus className="w-4 h-4 mr-2" />
                  {submitting ? 'Adding...' : 'Add Visibility'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Department Visibilities</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibilities.map((vis) => {
                    const user = users.find((u) => u.id === vis.user_id);
                    return (
                      <TableRow key={vis.id}>
                        <TableCell>{user?.name || 'Unknown'}</TableCell>
                        <TableCell>{vis.department}</TableCell>
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
      </Tabs>
    </div>
  );
}
