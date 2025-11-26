import React from 'react';
import { ScheduleResult } from '../types';

interface Props {
    schedule: ScheduleResult[];
}

const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

export const ScheduleTable: React.FC<Props> = ({ schedule }) => {
    if (schedule.length === 0) return null;

    const maxStaff = Math.max(...schedule.map(s => s.staff.length));
    // Create array for headers [Nöbetçi 1, Nöbetçi 2...]
    const staffHeaders = Array.from({ length: maxStaff || 1 }, (_, i) => `Nöbetçi ${i + 1}`);

    return (
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 bg-white text-sm">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-900">Tarih</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-900">Gün</th>
                        {staffHeaders.map(h => (
                            <th key={h} className="px-4 py-2 text-left font-medium text-gray-900">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {schedule.map((day) => {
                        const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;
                        
                        // Row styling
                        const rowClass = isWeekend ? 'bg-orange-50' : 'hover:bg-gray-50';
                        const textClass = 'text-gray-700';

                        return (
                            <tr key={day.date} className={rowClass}>
                                <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">
                                    {day.date}
                                    {day.warning && (
                                        <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                                            !
                                        </span>
                                    )}
                                </td>
                                <td className={`px-4 py-2 whitespace-nowrap ${isWeekend ? 'font-bold text-orange-600' : 'text-gray-500'}`}>
                                    {dayNames[day.dayOfWeek]}
                                </td>
                                {Array.from({ length: Math.max(maxStaff, 1) }).map((_, idx) => (
                                    <td key={idx} className={`px-4 py-2 whitespace-nowrap ${textClass}`}>
                                        {day.staff[idx] || <span className="text-gray-300 italic">-</span>}
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};