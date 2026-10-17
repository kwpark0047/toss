import { Link } from 'react-router-dom';
import { Store } from 'lucide-react';
import { motion } from 'framer-motion';
import FreeAuthOptions from './FreeAuthOptions';

export default function Register() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f8f9fa] p-4 relative overflow-hidden">
      <div aria-hidden="true" className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-100 rounded-full blur-[120px] opacity-50" />
      <div aria-hidden="true" className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-[120px] opacity-50" />

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md z-10 rounded-[2rem] border border-white bg-white p-7 shadow-[0_20px_50px_rgba(0,0,0,0.05)] sm:p-10"
        aria-labelledby="signup-title"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg shadow-orange-500/20">
            <Store aria-hidden="true" className="h-8 w-8 text-white" />
          </div>
          <h1 id="signup-title" className="text-2xl font-extrabold tracking-tight text-slate-900">
            위마켓 회원가입
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            이메일 주소로 인증하고 계정을 만들어요. 휴대전화 문자 인증은 사용하지 않습니다.
          </p>
        </div>

        <FreeAuthOptions mode="signup" emailOnly />

        <div className="mt-6 border-t border-slate-100 pt-5 text-center">
          <p className="text-sm font-medium text-slate-500">
            이미 계정이 있으신가요?{' '}
            <Link to="/login" className="font-bold text-orange-600 hover:text-orange-700">
              로그인
            </Link>
          </p>
        </div>
      </motion.section>
    </main>
  );
}

