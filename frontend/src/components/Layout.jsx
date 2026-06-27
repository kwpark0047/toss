import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Users, LogOut, LogIn, UserPlus } from 'lucide-react';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-2 text-xl font-bold text-blue-600">
                <Users size={24} />
                CRM System
              </Link>
            </div>
            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <span className="text-gray-600">안녕하세요, {user.name}님</span>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-red-600"
                  >
                    <LogOut size={18} />
                    로그아웃
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-blue-600"
                  >
                    <LogIn size={18} />
                    로그인
                  </Link>
                  <Link
                    to="/register"
                    className="flex items-center gap-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <UserPlus size={18} />
                    회원가입
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;
