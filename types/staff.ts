export interface Staff {
  id: number;
  store_id: number;
  user_id: number;
  role: StaffRole;
  pin_code?: string | null;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export type StaffRole = 'owner' | 'manager' | 'staff' | 'kitchen' | 'user' | 'super_admin';

export interface StaffListItem {
  id: number;
  user_id: number;
  name: string | null;
  email: string | null;
  role: StaffRole;
  created_at?: Date | null;
}

export interface CreateStaffInput {
  storeId: number | string;
  name: string;
  email: string;
  password: string;
  role?: string;
}

export interface AttendanceRecord {
  id: number;
  staff_id: number;
  store_id: number;
  clock_in: Date;
  clock_out?: Date | null;
  work_hours?: number | null;
  note?: string | null;
  staff?: {
    users: { name?: string; email?: string };
  };
}

export interface AttendanceQuery {
  date?: string;
  month?: string;
}

export interface ScheduleEntry {
  staff_id: number | string;
  date: string | Date;
  start_time: string;
  end_time: string;
  role?: string | null;
  note?: string | null;
}

export interface StaffSchedule {
  id: number;
  staff_id: number;
  store_id: number;
  date: Date;
  start_time: string;
  end_time: string;
  role?: string | null;
  note?: string | null;
  staff?: {
    users: { id: number; name?: string; email?: string; phone?: string };
  };
}

export interface ScheduleUpdateData {
  start_time?: string;
  end_time?: string;
  role?: string | null;
  note?: string | null;
}

export interface UserLookupResult {
  found: boolean;
  alreadyStaff?: boolean;
  user?: {
    id: number;
    name: string | null;
    phone: string;
  };
}

export interface RoleResult {
  role: StaffRole;
  staff_id?: number | null;
}

export interface AddExistingUserInput {
  storeId: number | string;
  userId: number | string;
  role?: string;
}
