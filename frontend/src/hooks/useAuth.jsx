import { useAuth as useAuthContext } from '../contexts/AuthContext';
import { AuthProvider as AuthContextProvider } from '../contexts/AuthContext';

export const useAuth = useAuthContext;
export const AuthProvider = AuthContextProvider;
