import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

const passwordSchema = z.object({
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters' })
    .max(128, { message: 'Password must be less than 128 characters' })
    .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
    .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
    .regex(/[0-9]/, { message: 'Password must contain at least one number' }),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function ChangePassword() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    // Validate input
    const validation = passwordSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError.message);
      setLoading(false);
      return;
    }

    try {
      // Update password
      const { error: passwordError } = await supabase.auth.updateUser({
        password: validation.data.password
      });

      if (passwordError) {
        toast.error(passwordError.message);
        setLoading(false);
        return;
      }

      // Update profile to remove password change flag
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ needs_password_change: false })
        .eq('id', user?.id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
        toast.error('Failed to update profile. Please contact support.');
        setLoading(false);
        return;
      }

      toast.success('Password changed successfully! Redirecting...');
      
      // Wait a moment for the database update to propagate
      setTimeout(() => {
        navigate('/');
        window.location.reload(); // Force reload to refresh auth state
      }, 1000);
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error('An error occurred while changing your password');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dashboard-bg p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set Your Password</CardTitle>
          <CardDescription>
            Please create a new password for your account. This will be your password for future logins.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <PasswordInput
                id="password"
                name="password"
                required
                placeholder="••••••••"
              />
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters with uppercase, lowercase, and number
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                required
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Changing Password...' : 'Change Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
