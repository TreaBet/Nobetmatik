import { StaffQuota, DayConstraint, ScheduleResult, GenerationResult, Statistics } from '../types';

// Helper: Check if person is on leave for a specific day number
const isPersonOnLeave = (name: string, day: number, leaves: DayConstraint[]): boolean => {
    const record = leaves.find(l => l.name === name);
    return record ? record.days.includes(day) : false;
};

// Helper: Fill a specific day with staff based on constraints
const fillDaySlots = (
    dayIndex: number, // 0-based index in schedule array
    schedule: ScheduleResult[],
    quotas: StaffQuota[],
    leaves: DayConstraint[],
    remainingQuota: Map<string, number>,
    dayOfWeekCounts: Map<string, number[]>, // [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
    perDay: number,
    logs: string[]
): number => { // Returns number of empty slots
    
    const currentDay = schedule[dayIndex];
    const dayNum = currentDay.dayOfMonth;
    const dow = currentDay.dayOfWeek;
    const isWeekend = dow === 0 || dow === 6;
    
    // Check existing staff (from requests)
    const currentStaff = currentDay.staff;
    const needed = perDay - currentStaff.length;

    if (needed <= 0) return 0;

    // Look at adjacent days
    const yesterdayStaff = dayIndex > 0 ? schedule[dayIndex - 1].staff : [];
    const tomorrowStaff = dayIndex < schedule.length - 1 ? schedule[dayIndex + 1].staff : [];

    const candidates: { name: string, score: number }[] = [];

    for (const q of quotas) {
        const name = q.name;

        // Skip if already assigned to this day
        if (currentStaff.includes(name)) continue;

        let score = 0;

        // --- HARD CONSTRAINTS (Must not happen) ---
        // Weights set to 100,000,000 to be effectively infinite.

        // 1. No Quota Left
        if ((remainingQuota.get(name) || 0) <= 0) score += 100000000;

        // 2. On Leave
        if (isPersonOnLeave(name, dayNum, leaves)) score += 100000000;

        // 3. Fatigue / Adjacency Rules ("Gün Aşırı Kuralı")
        // STRICT: Cannot work today if worked yesterday.
        if (yesterdayStaff.includes(name)) score += 100000000;
        
        // STRICT: Cannot work today if working tomorrow.
        // Note: In shuffled order, tomorrow might not be filled yet. That's okay.
        // If tomorrow IS filled, this constraint protects us.
        if (tomorrowStaff.includes(name)) score += 100000000;

        const personCounts = dayOfWeekCounts.get(name) || [0,0,0,0,0,0,0];

        // --- STRICT DAY LIMITS (Thu, Fri, Sat, Sun) ---
        // Requirement: "Strict Thursday cannot be greater than 1, Friday too"
        // Requirement: "No 2 Saturdays or No 2 Sundays"
        
        // Max 1 Thursday
        if (dow === 4 && personCounts[4] >= 1) score += 100000000;
        
        // Max 1 Friday
        if (dow === 5 && personCounts[5] >= 1) score += 100000000;

        // Max 1 Saturday
        if (dow === 6 && personCounts[6] >= 1) score += 100000000;

        // Max 1 Sunday
        if (dow === 0 && personCounts[0] >= 1) score += 100000000;

        // --- DISTRIBUTION CONSTRAINTS ---

        const countOnThisDayType = personCounts[dow];

        // Penalty for having more shifts on this specific day of week than others
        score += countOnThisDayType * 5000000;

        // --- WEEKEND COUNT LIMIT ---
        // Requirement: "Weekend shift count cannot be greater than 2"
        const totalWeekendShifts = personCounts[0] + personCounts[6]; // Sun + Sat
        if (isWeekend && totalWeekendShifts >= 2) {
             score += 100000000;
        }

        // --- SOFT CONSTRAINTS ---

        // Spacing: Try not to work every other day if possible (e.g., Mon, Wed, Fri pattern)
        const twoDaysAgoStaff = dayIndex > 1 ? schedule[dayIndex - 2].staff : [];
        if (twoDaysAgoStaff.includes(name)) score += 500;

        // Load Balancing heuristic: Prefer people with MORE remaining quota (fill them earlier)
        // This helps prevent "dumping" shifts at the end of the month
        score -= (remainingQuota.get(name) || 0) * 100;

        // Random noise for variation to break ties and allow Monte Carlo to explore
        score += Math.random() * 50;

        candidates.push({ name, score });
    }

    // Sort by score ascending (Lowest score is best candidate)
    candidates.sort((a, b) => a.score - b.score);

    let filledCount = 0;
    for (const cand of candidates) {
        if (filledCount >= needed) break;

        // If score is dangerously high (Hard constraints violated), stop assigning.
        if (cand.score < 10000000) {
            currentDay.staff.push(cand.name);
            remainingQuota.set(cand.name, remainingQuota.get(cand.name)! - 1);

            // Update Day Counts
            const pCounts = dayOfWeekCounts.get(cand.name)!;
            pCounts[dow]++; 
            dayOfWeekCounts.set(cand.name, pCounts);

            filledCount++;
        }
    }

    if (currentDay.staff.length < perDay) {
        return perDay - currentDay.staff.length;
    }

    return 0;
};

const attemptSchedule = (
    year: number,
    month: number, // 0-indexed
    quotas: StaffQuota[],
    leaves: DayConstraint[],
    requests: DayConstraint[],
    perDay: number
): { schedule: ScheduleResult[], logs: string[], score: number } => {
    
    const logs: string[] = [];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Trackers
    const remainingQuota = new Map<string, number>();
    quotas.forEach(q => remainingQuota.set(q.name, q.quota));

    // Track specific day counts for "1 of each" rule
    // Map<Name, [Sun, Mon, Tue, Wed, Thu, Fri, Sat]>
    const dayOfWeekCounts = new Map<string, number[]>();
    quotas.forEach(q => dayOfWeekCounts.set(q.name, [0, 0, 0, 0, 0, 0, 0]));

    const requestMap = new Map<number, string[]>();
    requests.forEach(req => {
        req.days.forEach(d => {
            if (!requestMap.has(d)) requestMap.set(d, []);
            requestMap.get(d)?.push(req.name);
        });
    });

    // --- PHASE 0: Initialize Skeleton ---
    const schedule: ScheduleResult[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
        // FIX: Use Date.UTC to ensure we get the specific date at 00:00:00 UTC
        // This prevents Timezone issues (like 30 Nov instead of 1 Dec)
        const dateObj = new Date(Date.UTC(year, month, day));
        const dayOfWeek = dateObj.getUTCDay(); // 0=Sun...6=Sat (Must use UTC day)
        
        schedule.push({
            // toISOString() is always UTC, so this matches perfectly
            date: dateObj.toISOString().split('T')[0],
            dayOfMonth: day,
            dayOfWeek,
            staff: [],
            isWeekend: dayOfWeek === 0 || dayOfWeek === 6
        });
    }

    // --- PHASE 1: Process Requests (Global) ---
    for (let i = 0; i < schedule.length; i++) {
        const dayObj = schedule[i];
        const dow = dayObj.dayOfWeek;

        const dayRequests = requestMap.get(dayObj.dayOfMonth) || [];
        const shuffled = [...dayRequests].sort(() => Math.random() - 0.5);

        for (const applicant of shuffled) {
            if (dayObj.staff.length >= perDay) {
                logs.push(`Warning: Day ${dayObj.dayOfMonth} full. Request for ${applicant} ignored.`);
                continue;
            }
            if (isPersonOnLeave(applicant, dayObj.dayOfMonth, leaves)) {
                logs.push(`Warning: ${applicant} requested Day ${dayObj.dayOfMonth} but is on leave.`);
                continue;
            }
            
            const q = remainingQuota.get(applicant) || 0;
            if (q > 0) {
                dayObj.staff.push(applicant);
                remainingQuota.set(applicant, q - 1);
                
                const pCounts = dayOfWeekCounts.get(applicant)!;
                pCounts[dow]++;
                dayOfWeekCounts.set(applicant, pCounts);
            } else {
                logs.push(`Warning: ${applicant} quota exceeded for request Day ${dayObj.dayOfMonth}.`);
            }
        }
    }

    let emptySlotsTotal = 0;

    // --- PHASE 2: Critical Days (Thu, Fri, Sat, Sun) ---
    // Change: Process these in RANDOM ORDER. 
    // This allows the algorithm to fill the 19th/20th before the 26th/27th in some iterations,
    // finding a valid configuration that distributes the "filled" days better.
    
    const criticalIndices: number[] = [];
    for (let i = 0; i < schedule.length; i++) {
        const dow = schedule[i].dayOfWeek;
        if (dow === 0 || dow === 4 || dow === 5 || dow === 6) {
            criticalIndices.push(i);
        }
    }
    
    // Fisher-Yates Shuffle
    for (let i = criticalIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [criticalIndices[i], criticalIndices[j]] = [criticalIndices[j], criticalIndices[i]];
    }

    // Fill critical days in shuffled order
    for (const idx of criticalIndices) {
        emptySlotsTotal += fillDaySlots(idx, schedule, quotas, leaves, remainingQuota, dayOfWeekCounts, perDay, logs);
    }

    // --- PHASE 3: Remaining Weekdays (Mon, Tue, Wed) ---
    // These can also be shuffled for better distribution, or kept linear. 
    // Shuffling is generally safer for finding solutions.
    const standardIndices: number[] = [];
    for (let i = 0; i < schedule.length; i++) {
        const dow = schedule[i].dayOfWeek;
        if (dow === 1 || dow === 2 || dow === 3) {
            standardIndices.push(i);
        }
    }

    // Fisher-Yates Shuffle for standard days
    for (let i = standardIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [standardIndices[i], standardIndices[j]] = [standardIndices[j], standardIndices[i]];
    }

    for (const idx of standardIndices) {
         emptySlotsTotal += fillDaySlots(idx, schedule, quotas, leaves, remainingQuota, dayOfWeekCounts, perDay, logs);
    }
    
    // Post-process warnings
    schedule.forEach(d => {
        if (d.staff.length < perDay) {
            d.warning = "Understaffed";
        }
    });

    // Score Calculation:
    // Base score = empty slots (We want 0)
    // Tie-breaker: Minimize standard deviation of assignments? 
    // For now, minimizing empty slots is the primary goal requested.
    return { schedule, logs, score: emptySlotsTotal };
};

export const generateSchedule = (
    year: number,
    month: number,
    quotas: StaffQuota[],
    leaves: DayConstraint[],
    requests: DayConstraint[],
    perDay: number
): GenerationResult => {
    
    let bestSchedule: ScheduleResult[] = [];
    let bestLogs: string[] = [];
    let minEmptySlots = Infinity;

    // Monte Carlo: Increase iterations to 100 to allow the random shuffling
    // to find the specific combination that fills gaps (e.g. 19/20) correctly.
    const MAX_ITERATIONS = 100;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        const result = attemptSchedule(year, month, quotas, leaves, requests, perDay);
        
        // Optimize for fewer empty slots first
        if (result.score < minEmptySlots) {
            minEmptySlots = result.score;
            bestSchedule = result.schedule;
            bestLogs = result.logs;
        }
        
        // If we found a perfect schedule, stop early
        if (minEmptySlots === 0) break; 
    }

    // Generate Stats
    const stats: Statistics[] = quotas.map(q => {
        let assigned = 0;
        let weekendShifts = 0;
        
        bestSchedule.forEach(day => {
            if (day.staff.includes(q.name)) {
                assigned++;
                if (day.dayOfWeek === 6 || day.dayOfWeek === 0) {
                    weekendShifts++;
                }
            }
        });

        return {
            name: q.name,
            target: q.quota,
            assigned,
            weekendShifts
        };
    });

    return {
        schedule: bestSchedule,
        stats,
        logs: bestLogs,
        success: minEmptySlots === 0
    };
};