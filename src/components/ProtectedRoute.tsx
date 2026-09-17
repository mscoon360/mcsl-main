import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, needsPasswordChange, isSalesOnly } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (!loading && user && needsPasswordChange) {
      navigate('/change-password');
    } else if (!loading && user && isSalesOnly && location.pathname !== '/pos') {
      navigate('/pos', { replace: true });
    }
  }, [user, loading, needsPasswordChange, isSalesOnly, location.pathname, navigate]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
