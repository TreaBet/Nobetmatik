
import { Staff, Service, DaySchedule, SchedulerConfig, ScheduleResult, ShiftAssignment } from '../types';

export class Scheduler {
  private staff: Staff[];
  private services: Service[];
  private config: SchedulerConfig;
  private daysInMonth: number;
  private logs: string[] = [];

  constructor(staff: Staff[], services: Service[], config: SchedulerConfig) {
    this.staff = staff;
    this.services = services;
    this.config = config;
    this.daysInMonth = new Date(config.year, config.month + 1, 0).getDate();
  }

  private isWeekend(day: number): boolean {
    const date = new Date(this.config.year, this.config.month, day);
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
  }

  private getDayOfWeek(day: number): number {
    return new Date(this.config.year, this.config.month, day).getDay();
  }

  private log(message: string) {
    if (this.logs.length < 1000) { // Prevent infinite memory issues
      this.logs.push(message);
    }
  }

  public generate(): ScheduleResult {
    let bestResult: ScheduleResult | null = null;
    let minUnfilled = Infinity;
    let bestDeviation = Infinity;

    // Monte Carlo Simulation Loop
    // User can define iteration count in config.maxRetries
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      this.logs = []; // Reset logs for this attempt
      const currentResult = this.runSimulation(attempt);
      
      // Metric: Total deviation from target quotas (should be 0 for exact match)
      const totalDeviation = currentResult.stats.reduce((acc, s) => {
        const staffDef = this.staff.find(st => st.id === s.staffId);
        if (!staffDef) return acc;
        return acc + Math.abs(staffDef.quotaService - s.serviceShifts) + Math.abs(staffDef.quotaEmergency - s.emergencyShifts);
      }, 0);

      // Prioritize: 1. Unfilled Slots (Must be 0 if possible) -> 2. Quota Deviation (Must be 0)
      if (currentResult.unfilledSlots < minUnfilled) {
        minUnfilled = currentResult.unfilledSlots;
        bestDeviation = totalDeviation;
        bestResult = currentResult;
      } else if (currentResult.unfilledSlots === minUnfilled && totalDeviation < bestDeviation) {
        bestDeviation = totalDeviation;
        bestResult = currentResult;
      }
    }

    if (!bestResult) {
      throw new Error("Could not generate a schedule");
    }

    return bestResult;
  }

  private hasShiftOnDay(assignmentsMap: Map<number, ShiftAssignment[]>, day: number, staffId: string): boolean {
    const assignments = assignmentsMap.get(day);
    if (!assignments) return false;
    return assignments.some(a => a.staffId === staffId);
  }

  private runSimulation(attemptIndex: number): ScheduleResult {
    // We use a Map to store assignments because we might fill days in random order
    const dayAssignmentsMap = new Map<number, ShiftAssignment[]>();
    for(let d=1; d<=this.daysInMonth; d++) {
        dayAssignmentsMap.set(d, []);
    }

    // Stats: { total, service, emergency, weekend, saturday, sunday }
    const staffStats = new Map<string, { total: number, service: number, emergency: number, weekend: number, saturday: number, sunday: number }>();
    this.staff.forEach(s => staffStats.set(s.id, { total: 0, service: 0, emergency: 0, weekend: 0, saturday: 0, sunday: 0 }));

    let unfilledSlots = 0;

    // Determine Order of Days to Process
    let daysToProcess = Array.from({length: this.daysInMonth}, (_, i) => i + 1);
    
    // Feature: Randomize Order
    // This helps distribute "empty slots" randomly if staff is insufficient, rather than piling up at end of month.
    if (this.config.randomizeOrder) {
        daysToProcess.sort(() => Math.random() - 0.5);
    }

    // Iterate Days
    for (const day of daysToProcess) {
      const dayOfWeek = this.getDayOfWeek(day);
      const isFriSatSun = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0;
      const isSat = dayOfWeek === 6;
      const isSun = dayOfWeek === 0;

      const currentDayAssignments = dayAssignmentsMap.get(day)!;
      const assignedTodayIds = new Set<string>();
      
      // NEW: Track group distribution for this specific day to ensure balance
      const dayGroupCounts: Record<string, number> = {};

      // Shuffle services to prevent bias
      const shuffledServices = [...this.services].sort(() => Math.random() - 0.5);

      for (const service of shuffledServices) {
        // Try to fill up to maxDailyCount
        let currentServiceCount = 0;

        // Iterate positions (1st person, 2nd person...)
        for (let i = 0; i < service.maxDailyCount; i++) {
          
          // Candidate Scoring
          const candidates = this.staff
            .filter(person => {
              // 1. Role Check
              if (!service.allowedRoles.includes(person.role)) return false;

              // 2. Hard Constraint: Already assigned today
              if (assignedTodayIds.has(person.id)) return false;

              // 3. Hard Constraint: Off Day
              if (person.offDays.includes(day)) return false;

              // 4. Hard Constraint: Worked Yesterday OR Tomorrow (No consecutive shifts)
              // Since we might be filling randomly, we must check both d-1 and d+1
              if (this.hasShiftOnDay(dayAssignmentsMap, day - 1, person.id)) return false;
              if (this.hasShiftOnDay(dayAssignmentsMap, day + 1, person.id)) return false;

              const stats = staffStats.get(person.id)!;

              // 5. Strict Quota Enforcement
              if (service.isEmergency) {
                if (stats.emergency >= person.quotaEmergency) return false;
              } else {
                if (stats.service >= person.quotaService) return false;
              }

              // 6. Hard Constraint: Weekend Limit
              if (isFriSatSun && stats.weekend >= person.weekendLimit) return false;

              // 7. Weekend Balance (Sat vs Sun)
              if (isSat) {
                if (stats.saturday >= stats.sunday + 1) return false;
              }
              if (isSun) {
                if (stats.sunday >= stats.saturday + 1) return false;
              }

              return true;
            })
            .map(person => {
              const stats = staffStats.get(person.id)!;
              let score = 0;

              // A. Priority Role Boost
              // If the user's role is in the Priority list, give them a massive boost.
              if (service.priorityRoles && service.priorityRoles.includes(person.role)) {
                  score -= 20000;
              }

              // B. Requested Day (Massive Priority)
              if (person.requestedDays && person.requestedDays.includes(day)) {
                  score -= 50000;
              }

              // C. Group Preference (Service Specific)
              if (service.preferredGroup && service.preferredGroup !== 'Farketmez') {
                  if (person.group === service.preferredGroup) score -= 10000;
                  else score += 5000;
              }

              // D. Urgency (If user is far from quota, prioritize heavily)
              const target = service.isEmergency ? person.quotaEmergency : person.quotaService;
              const current = service.isEmergency ? stats.emergency : stats.service;
              const remaining = target - current;
              
              score -= (remaining * 1000); 

              // E. Feature: Prevent "Günaşırı" (Every other day) patterns
              // If person worked d-2 or d+2, add penalty to encourage spacing
              if (this.config.preventEveryOtherDay) {
                  if (this.hasShiftOnDay(dayAssignmentsMap, day - 2, person.id)) score += 2500;
                  if (this.hasShiftOnDay(dayAssignmentsMap, day + 2, person.id)) score += 2500;
              }

              // F. Group Balance Strategy (Day General)
              // If this group is already represented on this day, add a penalty.
              // The more people from this group, the higher the penalty.
              const groupCount = dayGroupCounts[person.group] || 0;
              score += (groupCount * 2500);

              // G. Randomness
              score += Math.random() * 500;

              return { person, score };
            });

          // Sort by Score
          candidates.sort((a, b) => a.score - b.score);

          if (candidates.length > 0) {
            const selected = candidates[0].person;
            
            currentDayAssignments.push({
              serviceId: service.id,
              staffId: selected.id,
              staffName: selected.name,
              role: selected.role,
              group: selected.group,
              isEmergency: service.isEmergency
            });
            assignedTodayIds.add(selected.id);
            
            // Update Group Counts for this day
            dayGroupCounts[selected.group] = (dayGroupCounts[selected.group] || 0) + 1;

            currentServiceCount++;

            // Update Stats
            const stats = staffStats.get(selected.id)!;
            stats.total++;
            if (service.isEmergency) stats.emergency++;
            else stats.service++;
            
            if (isFriSatSun) stats.weekend++;
            if (isSat) stats.saturday++;
            if (isSun) stats.sunday++;

          } else {
            // Cannot find candidate
            if (currentServiceCount < service.minDailyCount) {
                 unfilledSlots++;
                 currentDayAssignments.push({
                    serviceId: service.id,
                    staffId: 'EMPTY',
                    staffName: `BOŞ (Min:${service.minDailyCount})`,
                    role: 0,
                    group: 'Genel',
                    isEmergency: service.isEmergency
                 });
                 if (attemptIndex === this.config.maxRetries - 1) {
                     this.log(`Gün ${day}, Servis '${service.name}': Uygun personel bulunamadı.`);
                 }
            } else {
                break; 
            }
          }
        }
      }
    }

    // Convert Map to Sorted Array
    const schedule: DaySchedule[] = [];
    for(let d=1; d<=this.daysInMonth; d++) {
        schedule.push({
            day: d,
            assignments: dayAssignmentsMap.get(d) || [],
            isWeekend: this.isWeekend(d)
        });
    }

    return {
      schedule,
      unfilledSlots,
      logs: this.logs,
      stats: Array.from(staffStats.entries()).map(([id, s]) => ({
        staffId: id,
        totalShifts: s.total,
        serviceShifts: s.service,
        emergencyShifts: s.emergency,
        weekendShifts: s.weekend,
        saturdayShifts: s.saturday,
        sundayShifts: s.sunday
      }))
    };
  }
}
