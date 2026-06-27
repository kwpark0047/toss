import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Store, Phone, Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const isEmail = (value) => value.includes('@');

const formatPhone = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleIdentifierChange = (e) => {
    const raw = e.target.value;
    // @ 포함이면 이메일 모드 — 그대로, 아니면 전화번호 포맷
    if (raw.includes('@') || raw === '') {
      setIdentifier(raw);
    } else {
      setIdentifier(formatPhone(raw));
    }
  };

  const isEmailMode = isEmail(identifier);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(identifier, password);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-100 rounded-full blur-[120px] opacity-50" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-[120px] opacity-50" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md z-10"
      >
        <div className="bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-white p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-orange-400 to-orange-600" />

          <div className="text-center mb-10">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-[0_10px_25px_rgba(249,115,22,0.3)] mb-6"
            >
              <Store className="w-10 h-10 text-white" />
            </motion.div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">위마켓</h1>
            <p className="text-slate-500 mt-3 font-medium text-lg">매장 관리 시스템 로그인</p>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, height: 0, x: -10 }}
                animate={{ opacity: 1, height: 'auto', x: [0, -4, 4, -4, 4, 0] }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-8 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 ml-1">
                핸드폰 번호 또는 이메일
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <AnimatePresence mode="wait">
                    {isEmailMode ? (
                      <motion.span key="mail" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                        <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                      </motion.span>
                    ) : (
                      <motion.span key="phone" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                        <Phone className="h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <input
                  type="text"
                  value={identifier}
                  onChange={handleIdentifierChange}
                  required
                  inputMode={isEmailMode ? 'email' : 'tel'}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none font-medium text-slate-900"
                  placeholder="010-1234-5678 또는 name@email.com"
                />
              </div>
              <p className="text-xs text-slate-400 ml-1">
                {isEmailMode ? '이메일 주소로 로그인합니다' : '핸드폰 번호로 로그인합니다'}
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 ml-1">
                비밀번호
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none font-medium text-slate-900"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="pt-2">
              <motion.button
                whileHover={{ scale: 1.01, translateY: -2 }}
                whileTap={{ scale: 0.98, translateY: 0 }}
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-bold text-lg shadow-[0_10px_20px_rgba(249,115,22,0.2)] hover:shadow-[0_15px_30px_rgba(249,115,22,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>로그인</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </motion.button>
            </div>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-50 text-center">
            <p className="text-slate-500 font-medium tracking-tight">
              계정이 없으신가요?{' '}
              <Link to="/register" className="text-orange-600 font-bold hover:text-orange-700 transition-colors underline-offset-4 hover:underline">
                핸드폰으로 가입하기
              </Link>
            </p>
          </div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="mt-8 text-center text-slate-400 text-sm font-medium"
        >
          &copy; 2024 WeMarket. All rights reserved.
        </motion.p>
      </motion.div>
    </div>
  );
};

export default Login;
