import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <h1 className="text-4xl font-bold text-slate-900 mb-4">404 - Page Not Found</h1>
      <p className="text-slate-500 mb-8">요청하신 페이지를 찾을 수 없습니다.</p>
      <Link to="/" className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold">
        홈으로 돌아가기
      </Link>
    </div>
  );
};

export default NotFound;
