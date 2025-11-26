export interface StaffQuota {
    name: string;
    quota: number;
}

export interface DayConstraint {
    name: string;
    days: number[];
}

export interface ScheduleResult {
    date: string; // ISO String YYYY-MM-DD
    dayOfMonth: number;
    dayOfWeek: number; // 0 (Sun) - 6 (Sat)
    staff: string[];
    isWeekend: boolean;
    warning?: string;
}

export interface Statistics {
    name: string;
    assigned: number;
    target: number;
    weekendShifts: number;
}

export interface GenerationResult {
    schedule: ScheduleResult[];
    stats: Statistics[];
    logs: string[];
    success: boolean;
}

export const SAMPLE_QUOTAS = `# Örnek: İsim: Sayı
Ahmet Yılmaz: 5
Mehmet Demir: 5
Ayşe Kaya: 5
Fatma Çelik: 5
Ali Veli: 5
Zeynep: 5`;

export const SAMPLE_LEAVES = `# Örnek: İsim: 1, 2, 15
Ahmet Yılmaz: 10, 11
`;

export const SAMPLE_REQUESTS = `# Örnek: İsim: 5, 20
Ayşe Kaya: 5
`;