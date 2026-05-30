import useStore from '../store/store';
import api from '../services/api';

export function useAuth() {
  const { user, isAuthenticated, setAuth, clearAuth, setUser } = useStore();

  const login = async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password });
    setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
    return res.data;
  };

  const register = async (name, email, password) => {
    const res = await api.post('/api/auth/register', { name, email, password });
    setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
    return res.data;
  };

  const logout = async () => {
    try { await api.post('/api/auth/logout'); } catch {}
    clearAuth();
  };

  const fetchMe = async () => {
    try {
      const res = await api.get('/api/auth/me');
      setUser(res.data.user);
      return res.data.user;
    } catch {
      clearAuth();
    }
  };

  return { user, isAuthenticated, login, register, logout, fetchMe };
}
