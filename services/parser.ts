import { StaffQuota, DayConstraint } from '../types';

export const parseQuotas = (text: string): StaffQuota[] => {
    const quotas: StaffQuota[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes(':')) continue;
        
        const [name, val] = trimmed.split(':');
        const parsedVal = parseInt(val.trim());
        
        if (name.trim() && !isNaN(parsedVal)) {
            quotas.push({ name: name.trim(), quota: parsedVal });
        }
    }
    return quotas;
};

export const parseDays = (text: string, daysInMonth: number): DayConstraint[] => {
    const constraints: DayConstraint[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes(':')) continue;
        
        const [name, daysStr] = trimmed.split(':');
        const days = daysStr.split(',')
            .map(d => parseInt(d.trim()))
            .filter(d => !isNaN(d) && d >= 1 && d <= daysInMonth);
            
        if (name.trim()) {
            constraints.push({ name: name.trim(), days });
        }
    }
    return constraints;
};