import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import AppRoutes from './routes/AppRoutes';
import { useAuth } from './hooks/useAuth';
import useStore from './store/store';

export default function App() {
  const { fetchMe } = useAuth();
  const isAuthenticated = useStore(s => s.isAuthenticated);
  const location = useLocation();
  const isAuthRoute = location.pathname === '/login' || location.pathname === '/register';
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (isAuthenticated) {
        await fetchMe();
      }
      setIsInitializing(false);
    };
    init();
  }, [isAuthenticated]);

  if (isInitializing) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-vault-primary/30 border-t-vault-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  // If on login page, don't show sidebar/header
  if (isAuthRoute) {
    return <AppRoutes />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-65">
        <Header />
        <main className="pt-22 px-8 pb-10">
          <AppRoutes />
        </main>
      </div>
    </div>
  );
}
