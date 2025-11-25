import React, { useState, useCallback } from 'react';
import { SAMPLE_LEAVES, SAMPLE_QUOTAS, SAMPLE_REQUESTS, GenerationResult } from './types';
import { parseDays, parseQuotas } from './services/parser';
import { generateSchedule } from './services/scheduler';
import { ScheduleTable } from './components/ScheduleTable';
import { StatsChart } from './components/StatsChart';

// Icons (SVG components)
const CalendarIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
);
const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
);
const AlertIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
);

export default function App() {
    // --- State ---
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [perDay, setPerDay] = useState<number>(1);
    
    const [rawQuotas, setRawQuotas] = useState<string>(SAMPLE_QUOTAS);
    const [rawLeaves, setRawLeaves] = useState<string>(SAMPLE_LEAVES);
    const [rawRequests, setRawRequests] = useState<string>(SAMPLE_REQUESTS);
    
    const [result, setResult] = useState<GenerationResult | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // --- Handlers ---
    
    const handleGenerate = useCallback(() => {
        setIsGenerating(true);
        
        // Small timeout to allow UI to update "Generating..." state
        setTimeout(() => {
            try {
                const [yearStr, monthStr] = selectedDate.split('-');
                const year = parseInt(yearStr);
                const month = parseInt(monthStr) - 1; // JS Date 0-11
                const daysInMonth = new Date(year, month + 1, 0).getDate();

                const quotas = parseQuotas(rawQuotas);
                const leaves = parseDays(rawLeaves, daysInMonth);
                const requests = parseDays(rawRequests, daysInMonth);

                // Basic validation
                const totalQuota = quotas.reduce((acc, curr) => acc + curr.quota, 0);
                const totalNeeded = daysInMonth * perDay;

                if (quotas.length === 0) {
                    alert("Please define at least one staff member in Quotas.");
                    setIsGenerating(false);
                    return;
                }

                // Run Algorithm
                const genResult = generateSchedule(year, month, quotas, leaves, requests, perDay);
                
                if (totalQuota < totalNeeded) {
                    genResult.logs.unshift(`WARNING: Total Quota (${totalQuota}) is less than Total Needed (${totalNeeded}). Some slots will be empty.`);
                }

                setResult(genResult);
            } catch (e) {
                alert("An error occurred during generation. Check your inputs.");
                console.error(e);
            } finally {
                setIsGenerating(false);
            }
        }, 100);
    }, [selectedDate, perDay, rawQuotas, rawLeaves, rawRequests]);

    const downloadCSV = () => {
        if (!result) return;
        
        const headers = ['Date', 'Day', ...Array.from({length: perDay}, (_, i) => `Staff ${i+1}`)];
        const rows = result.schedule.map(d => {
            const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.dayOfWeek];
            // Fill empty slots with -
            const staffCells = [...d.staff];
            while(staffCells.length < perDay) staffCells.push("-");
            return [d.date, dayName, ...staffCells];
        });

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Schedule_${selectedDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="min-h-screen bg-gray-50 font-sans pb-20">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                            <CalendarIcon />
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Nobetmatik Web</h1>
                    </div>
                    <div className="text-sm text-gray-500">v17.0 (Ported)</div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                
                {/* Controls Section */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex flex-wrap gap-6 mb-6 items-end">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Select Month</label>
                            <input 
                                type="month" 
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Staff Per Day</label>
                            <input 
                                type="number" 
                                min="1" 
                                max="10"
                                value={perDay}
                                onChange={(e) => setPerDay(parseInt(e.target.value) || 1)}
                                className="block w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                            />
                        </div>
                        <div className="flex-grow"></div>
                        <button 
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-medium shadow-sm transition-all
                                ${isGenerating ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow'}`}
                        >
                            {isGenerating ? 'Optimizing...' : 'Generate Schedule'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-blue-700">1. Quotas (Name: Count)</label>
                            <textarea 
                                value={rawQuotas}
                                onChange={e => setRawQuotas(e.target.value)}
                                className="w-full h-48 p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                                placeholder="Ahmet: 5"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-red-700">2. Leaves (Name: Day, Day...)</label>
                            <textarea 
                                value={rawLeaves}
                                onChange={e => setRawLeaves(e.target.value)}
                                className="w-full h-48 p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono text-sm"
                                placeholder="Ahmet: 1, 2"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-green-700">3. Requests (Name: Day...)</label>
                            <textarea 
                                value={rawRequests}
                                onChange={e => setRawRequests(e.target.value)}
                                className="w-full h-48 p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                                placeholder="Ahmet: 5"
                            />
                        </div>
                    </div>
                </div>

                {/* Results Section */}
                {result && (
                    <div className="space-y-8 animate-fade-in">
                        
                        {/* Statistics & Logs */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Chart */}
                            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                <StatsChart data={result.stats} />
                            </div>

                            {/* Logs */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-[400px]">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                    <AlertIcon /> Operation Logs
                                </h3>
                                <div className="flex-1 overflow-y-auto bg-gray-50 rounded border border-gray-200 p-3 font-mono text-xs text-gray-600 space-y-1">
                                    {result.logs.length === 0 ? (
                                        <span className="text-green-600">No warnings generated. Perfect run.</span>
                                    ) : (
                                        result.logs.map((log, i) => (
                                            <div key={i} className={log.includes('Warning') || log.includes('Critical') ? 'text-amber-600' : 'text-gray-600'}>
                                                {log}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-gray-900">Generated Schedule</h2>
                                <button 
                                    onClick={downloadCSV}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    <DownloadIcon /> Export CSV
                                </button>
                            </div>
                            <ScheduleTable schedule={result.schedule} />
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}