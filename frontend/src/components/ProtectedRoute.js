import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Skeleton, { SkeletonCard } from '@/components/Skeleton';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <SkeletonCard lines={4} className="max-w-md" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;