
export type Role = number; // 1, 2, 3, 4 etc.
export type Group = 'A' | 'B' | 'C' | 'D' | 'Genel';

export interface Staff {
  id: string;
  name: string;
  role: number; // Numeric seniority level
  group: Group;
  quotaService: number; // Target for normal services
  quotaEmergency: number; // Target for emergency services
  weekendLimit: number; // Max weekend shifts
  offDays: number[]; // Days of month they cannot work
  requestedDays: number[]; // Days they specifically want to work
}

export interface RoleConfig {
  role: number;
  quotaService: number;
  quotaEmergency: number;
  weekendLimit: number;
}

export interface Service {
  id: string;
  name: string;
  minDailyCount: number; // Min staff needed
  maxDailyCount: number; // Max staff allowed
  allowedRoles: number[]; // Array of role numbers allowed (e.g. [1, 2])
  priorityRoles?: number[]; // Preferred roles for this service
  preferredGroup?: Group | 'Farketmez';
  isEmergency: boolean; // True if this counts towards Emergency Quota
}

export interface ShiftAssignment {
  serviceId: string;
  staffId: string;
  staffName: string;
  role: number;
  group: Group;
  isEmergency: boolean;
}

export interface DaySchedule {
  day: number;
  assignments: ShiftAssignment[];
  isWeekend: boolean;
}

export interface Stats {
    staffId: string;
    totalShifts: number;
    serviceShifts: number;
    emergencyShifts: number;
    weekendShifts: number;
    saturdayShifts: number;
    sundayShifts: number;
}

export interface ScheduleResult {
  schedule: DaySchedule[];
  unfilledSlots: number;
  logs: string[]; // Error logs
  stats: Stats[];
}

export interface SchedulerConfig {
  year: number;
  month: number; // 0-11
  maxRetries: number;
  randomizeOrder: boolean; // Process days in random order
  preventEveryOtherDay: boolean; // Avoid Day-2 / Day+2 patterns
}
