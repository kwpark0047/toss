import { lazy, Suspense } from 'react';
const AdminLayout = lazy(() => import('@/components/admin/AdminLayout'));
const MasterDashboard = lazy(() => import('@/components/admin/MasterDashboard'));

const AdminDashboard = () => {
  return (
    <Suspense fallback={<div>Loading Admin...</div>}>
      <AdminLayout>
        <MasterDashboard />
      </AdminLayout>
    </Suspense>
  );
};

export default AdminDashboard;
