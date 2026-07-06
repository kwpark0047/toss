import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { customersAPI } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Edit, Trash2, Mail, Phone, Building, Calendar } from 'lucide-react';

const statusColors = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  lead: 'bg-yellow-100 text-yellow-800',
};

const statusLabels = {
  active: '활성',
  inactive: '비활성',
  lead: '잠재고객',
};

const CustomerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customersAPI.getById(id)
      .then((res) => setCustomer(res.data))
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleDelete = async () => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      await customersAPI.delete(id);
      navigate('/');
    } catch (error) {
      alert(error.response?.data?.error || '삭제 실패');
    }
  };

  // [프리미엄 스켈레톤 UI]
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
        <div className="w-24 h-6 bg-gray-100 rounded-lg mb-8" />
        <div className="bg-white rounded-3xl shadow-soft overflow-hidden border border-gray-100">
          <div className="p-8 border-b border-gray-50 flex justify-between">
            <div className="space-y-3 w-1/2">
              <div className="w-32 h-8 bg-gray-200 rounded-xl" />
              <div className="w-20 h-6 bg-gray-100 rounded-full" />
            </div>
            <div className="flex gap-2">
              <div className="w-20 h-10 bg-gray-100 rounded-xl" />
              <div className="w-20 h-10 bg-gray-100 rounded-xl" />
            </div>
          </div>
          <div className="p-8 grid grid-cols-2 gap-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-xl" />
                <div className="space-y-2 py-1">
                  <div className="w-16 h-4 bg-gray-100 rounded" />
                  <div className="w-32 h-5 bg-gray-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-24 bg-white/40 backdrop-blur-sm rounded-[3rem] border border-dashed border-gray-200"
      >
        <p className="text-gray-500 font-black text-xl">고객을 찾을 수 없습니다.</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-3xl mx-auto pb-12"
    >
      <button
        onClick={() => navigate('/')}
        className="group flex items-center gap-3 text-slate-400 hover:text-slate-900 mb-10 transition-all font-black text-[11px] tracking-[0.3em] uppercase"
      >
        <ArrowLeft size={18} className="group-hover:-translate-x-2 transition-transform" />
        Back to Directory
      </button>

      <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-xl shadow-slate-200/50 overflow-hidden border border-white/60">
        {/* Header Section */}
        <div className="p-8 md:p-12 border-b border-slate-100 bg-gradient-to-br from-slate-50/50 to-white">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="h-0.5 w-10 bg-slate-200"></span>
                <span className="text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase italic">Customer Profile</span>
              </div>
              <h1 className="text-5xl md:text-6xl font-serif font-black italic tracking-tighter text-slate-900 leading-none">
                {customer.name}
              </h1>
              <div className="flex items-center gap-2 mt-4">
                <span className={`px-5 py-2 text-[10px] font-black rounded-full uppercase tracking-widest shadow-sm ${statusColors[customer.status]}`}>
                  {statusLabels[customer.status]}
                </span>
                <span className="px-5 py-2 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-full uppercase tracking-widest shadow-sm">
                  VIP TIER
                </span>
              </div>
            </div>
            {user && (
              <div className="flex gap-4">
                <Link
                  to={`/customers/${id}/edit`}
                  className="flex items-center gap-3 px-8 py-4 bg-white border-2 border-slate-900 text-slate-900 rounded-2xl font-black text-[11px] tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-lg active:scale-95"
                >
                  <Edit size={16} />
                  EDIT
                </Link>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-3 px-8 py-4 bg-rose-50 text-rose-600 rounded-2xl font-black text-[11px] tracking-widest hover:bg-rose-600 hover:text-white transition-all shadow-lg shadow-rose-600/10 active:scale-95 border-2 border-transparent"
                >
                  <Trash2 size={16} />
                  DISCARD
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Detailed Info Grid */}
        <div className="p-8 md:p-12 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-12 gap-x-16">
            <motion.div whileHover={{ x: 5 }} className="flex items-start gap-6 group">
              <div className="p-5 bg-slate-50 rounded-[1.5rem] group-hover:bg-indigo-50 transition-colors shadow-inner">
                <Mail className="text-slate-400 group-hover:text-indigo-600 transition-colors" size={24} />
              </div>
              <div className="space-y-1 py-1">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Digital Address</p>
                <p className="text-lg font-serif italic font-black text-slate-900">
                  {customer.email ? (
                    <a href={`mailto:${customer.email}`} className="hover:text-indigo-600 transition-colors">
                      {customer.email}
                    </a>
                  ) : (
                    '-'
                  )}
                </p>
              </div>
            </motion.div>

            <motion.div whileHover={{ x: 5 }} className="flex items-start gap-6 group">
              <div className="p-5 bg-slate-50 rounded-[1.5rem] group-hover:bg-emerald-50 transition-colors shadow-inner">
                <Phone className="text-slate-400 group-hover:text-emerald-600 transition-colors" size={24} />
              </div>
              <div className="space-y-1 py-1">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Call Line</p>
                <p className="text-lg font-serif italic font-black text-slate-900">
                  {customer.phone ? (
                    <a href={`tel:${customer.phone}`} className="hover:text-emerald-600 transition-colors">
                      {customer.phone}
                    </a>
                  ) : (
                    '-'
                  )}
                </p>
              </div>
            </motion.div>

            <motion.div whileHover={{ x: 5 }} className="flex items-start gap-6 group">
              <div className="p-5 bg-slate-50 rounded-[1.5rem] group-hover:bg-amber-50 transition-colors shadow-inner">
                <Building className="text-slate-400 group-hover:text-amber-600 transition-colors" size={24} />
              </div>
              <div className="space-y-1 py-1">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Affiliation</p>
                <p className="text-lg font-serif italic font-black text-slate-900">{customer.company || '-'}</p>
              </div>
            </motion.div>

            <motion.div whileHover={{ x: 5 }} className="flex items-start gap-6 group">
              <div className="p-5 bg-slate-50 rounded-[1.5rem] group-hover:bg-rose-50 transition-colors shadow-inner">
                <Calendar className="text-slate-400 group-hover:text-rose-600 transition-colors" size={24} />
              </div>
              <div className="space-y-1 py-1">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Registration Date</p>
                <p className="text-lg font-serif italic font-black text-slate-900">
                  {new Date(customer.created_at).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </motion.div>
          </div>

          {/* Notes Section */}
          <div className="pt-12 border-t border-slate-50">
            <div className="flex items-center gap-4 mb-8">
              <span className="text-[11px] font-black tracking-[0.4em] text-slate-900 uppercase italic">Archive Notes /</span>
              <span className="flex-1 h-px bg-slate-50"></span>
            </div>
            <div className="bg-slate-50/50 rounded-[2rem] p-8 md:p-12 border border-slate-100 shadow-inner group transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/50">
              <p className="text-xl md:text-2xl font-serif italic text-slate-700 leading-relaxed whitespace-pre-wrap group-hover:text-slate-900 transition-colors">
                {customer.notes || '이 고객에 대한 특별한 메모가 없습니다.'}
              </p>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-6 pt-8">
            {[
              { label: 'Total Orders', value: '128', color: 'bg-indigo-600' },
              { label: 'Total Spent', value: '₩2.4M', color: 'bg-slate-900' },
              { label: 'Loyalty Points', value: '4,250', color: 'bg-orange-500' }
            ].map(stat => (
              <div key={stat.label} className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm hover:translate-y-[-4px] transition-all">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{stat.label}</p>
                <p className="text-2xl font-serif font-black italic">{stat.value}</p>
                <div className={`h-1 w-8 ${stat.color} mt-3 rounded-full opacity-30`}></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default CustomerDetail;
