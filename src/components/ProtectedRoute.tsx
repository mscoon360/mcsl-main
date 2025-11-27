import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, needsPasswordChange } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log("[ProtectedRoute] state", { loading, hasUser: !!user, needsPasswordChange });
    if (!loading && !user) {
      navigate('/auth');
    } else if (!loading && user && needsPasswordChange) {
      navigate('/change-password');
    }
  }, [user, loading, needsPasswordChange, navigate]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
