import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { staffAPI, storesAPI } from '../../api';
import { ArrowLeft, Plus, Edit, Trash2, Users, Shield, ChefHat, UserCheck, User } from 'lucide-react';

const ROLES = {
  admin: { label: '관리자', color: 'bg-purple-100 text-purple-800', icon: Shield, description: '직원관리, 설정, 주문, 메뉴, 테이블, 통계' },
  manager: { label: '매니저', color: 'bg-blue-100 text-blue-800', icon: UserCheck, description: '주문, 메뉴, 통계' },
  staff: { label: '직원', color: 'bg-green-100 text-green-800', icon: User, description: '주문 처리' },
  kitchen: { label: '주방', color: 'bg-orange-100 text-orange-800', icon: ChefHat, description: '주문 확인만' }
};

const StaffManager = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [myRole, setMyRole] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff'
  });
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [storeRes, staffRes, roleRes] = await Promise.all([
        storesAPI.getById(storeId),
        staffAPI.getByStore(storeId),
        staffAPI.getMyRole(storeId)
      ]);
      setStore(storeRes.data);
      setStaff(staffRes.data);
      setMyRole(roleRes.data.role);
    } catch (error) {
      console.error('데이터 로딩 실패:', error);
      if (error.response?.status === 403) {
        navigate('/admin');
      }
    } finally {
      setLoading(false);
    }
  }, [storeId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.email || !formData.password || !formData.role) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    if (formData.password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    try {
      // staffAPI.create 인자 형식을 최신 API 명세(객체 통합)에 맞춰 수정
      await staffAPI.create({
        ...formData,
        storeId: parseInt(storeId)
      });
      setShowForm(false);
      setFormData({ name: '', email: '', password: '', role: 'staff' });
      fetchData();
    } catch (error) {
      setError(error.response?.data?.error || '직원 등록에 실패했습니다.');
    }
  };

  const handleRoleChange = async (id, newRole) => {
    try {
      await staffAPI.updateRole(id, newRole);
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || '역할 변경에 실패했습니다.');
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`${name} 직원을 삭제하시겠습니까?`)) return;
    try {
      await staffAPI.delete(id);
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || '삭제에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin')}
            className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-navy-800">직원 관리</h1>
            <p className="text-gray-500">{store?.name}</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
        >
          <Plus className="w-5 h-5" />
          직원 추가
        </button>
      </div>

      {/* 역할 설명 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {Object.entries(ROLES).map(([code, role]) => {
          const Icon = role.icon;
          return (
            <div key={code} className={`p-3 rounded-lg ${role.color} bg-opacity-50`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4" />
                <span className="font-medium text-sm">{role.label}</span>
              </div>
              <p className="text-xs opacity-75">{role.description}</p>
            </div>
          );
        })}
      </div>

      {/* 직원 목록 */}
      <div className="bg-white rounded-xl shadow-soft overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-600" />
            <span className="font-medium">등록된 직원 ({staff.length}명)</span>
          </div>
        </div>

        {staff.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>등록된 직원이 없습니다.</p>
            <p className="text-sm">직원 추가 버튼을 눌러 직원을 등록하세요.</p>
          </div>
        ) : (
          <div className="divide-y">
            {staff.map((member) => {
              const roleInfo = ROLES[member.role];
              const Icon = roleInfo?.icon || User;
              const canEdit = myRole === 'owner' || (myRole === 'admin' && member.role !== 'admin');

              return (
                <div key={member.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${roleInfo?.color || 'bg-gray-100'}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-gray-500">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {editingId === member.id ? (
                      <select
                        value={member.role}
                        onChange={(e) => {
                          handleRoleChange(member.id, e.target.value);
                          setEditingId(null);
                        }}
                        onBlur={() => setEditingId(null)}
                        autoFocus
                        className="px-3 py-1 border rounded-lg text-sm"
                      >
                        {Object.entries(ROLES).map(([code, role]) => (
                          <option key={code} value={code} disabled={code === 'admin' && myRole !== 'owner'}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`px-3 py-1 rounded-full text-sm ${roleInfo?.color || 'bg-gray-100'}`}>
                        {roleInfo?.label || member.role}
                      </span>
                    )}
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingId(member.id)}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="역할 변경"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(member.id, member.name)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 직원 추가 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">직원 추가</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="홍길동"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="staff@example.com"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="6자 이상"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">역할</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {Object.entries(ROLES).map(([code, role]) => (
                    <option key={code} value={code} disabled={code === 'admin' && myRole !== 'owner'}>
                      {role.label} - {role.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setError('');
                    setFormData({ name: '', email: '', password: '', role: 'staff' });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                >
                  등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManager;
