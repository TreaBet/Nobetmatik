import React, { useState, useCallback, useEffect } from 'react';
import { SAMPLE_LEAVES, SAMPLE_QUOTAS, SAMPLE_REQUESTS, GenerationResult } from './types';
import { parseDays, parseQuotas } from './services/parser';
import { generateSchedule } from './services/scheduler';
import { ScheduleTable } from './components/ScheduleTable';
import { StatsChart } from './components/StatsChart';
import ExcelJS from 'exceljs';
import FileSaver from 'file-saver';

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
    // --- State Initialization with LocalStorage ---
    
    // Helper to get from local storage or default
    const getStored = (key: string, def: any) => {
        const stored = localStorage.getItem(key);
        return stored ? stored : def;
    };

    const [selectedDate, setSelectedDate] = useState<string>(() => getStored('nobet_date', new Date().toISOString().slice(0, 7)));
    const [perDay, setPerDay] = useState<number>(() => parseInt(getStored('nobet_perDay', '1')));
    
    const [rawQuotas, setRawQuotas] = useState<string>(() => getStored('nobet_quotas', SAMPLE_QUOTAS));
    const [rawLeaves, setRawLeaves] = useState<string>(() => getStored('nobet_leaves', SAMPLE_LEAVES));
    const [rawRequests, setRawRequests] = useState<string>(() => getStored('nobet_requests', SAMPLE_REQUESTS));
    
    const [result, setResult] = useState<GenerationResult | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // --- Persistence Effects ---
    useEffect(() => { localStorage.setItem('nobet_date', selectedDate); }, [selectedDate]);
    useEffect(() => { localStorage.setItem('nobet_perDay', perDay.toString()); }, [perDay]);
    useEffect(() => { localStorage.setItem('nobet_quotas', rawQuotas); }, [rawQuotas]);
    useEffect(() => { localStorage.setItem('nobet_leaves', rawLeaves); }, [rawLeaves]);
    useEffect(() => { localStorage.setItem('nobet_requests', rawRequests); }, [rawRequests]);

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
                    alert("Lütfen 'Nöbet Sayısı' alanına en az bir kişi ekleyin.");
                    setIsGenerating(false);
                    return;
                }

                // Run Algorithm
                const genResult = generateSchedule(year, month, quotas, leaves, requests, perDay);
                
                if (totalQuota < totalNeeded) {
                    genResult.logs.unshift(`UYARI: Toplam Kota (${totalQuota}), Gereken Toplamdan (${totalNeeded}) az. Bazı nöbet yerleri boş kalacak.`);
                }

                setResult(genResult);
            } catch (e) {
                alert("Oluşturma sırasında bir hata oluştu. Girdilerinizi kontrol edin.");
                console.error(e);
            } finally {
                setIsGenerating(false);
            }
        }, 100);
    }, [selectedDate, perDay, rawQuotas, rawLeaves, rawRequests]);

    const handleDownloadExcel = async () => {
        if (!result) return;

        // Create workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Nöbet Listesi');

        // Define Columns
        // Base columns
        const columns = [
            { header: 'Tarih', key: 'date', width: 15 },
            { header: 'Gün', key: 'day', width: 10 },
        ];
        // Staff columns
        for (let i = 0; i < perDay; i++) {
            columns.push({ header: `Nöbetçi ${i + 1}`, key: `staff${i}`, width: 20 });
        }
        worksheet.columns = columns;

        // Add Data Rows
        result.schedule.forEach(day => {
            const dayName = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'][day.dayOfWeek];
            
            // Build row object dynamically based on perDay count
            const rowData: any = {
                date: day.date,
                day: dayName
            };
            
            day.staff.forEach((staffName, index) => {
                rowData[`staff${index}`] = staffName;
            });

            // Fill empty slots if any
            for(let i=day.staff.length; i<perDay; i++) {
                rowData[`staff${i}`] = "-";
            }

            const row = worksheet.addRow(rowData);

            // Styling
            const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;

            // Apply styles to each cell in the row
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                // Border
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };

                // Alignment
                cell.alignment = { vertical: 'middle', horizontal: 'left' };

                // Weekend Background Color (Orange-100 equivalent: #FFEDD5 -> FFFFEDD5 in ARGB)
                // Using a clearer orange for background
                if (isWeekend) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFFEDD5' }
                    };
                    // Text color remains black (default) as requested, removing orange text override
                    cell.font = { color: { argb: 'FF000000' } };
                }
            });
        });

        // Header Styling
        worksheet.getRow(1).eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF3F4F6' } // Gray-100
            };
            cell.border = { bottom: { style: 'medium' } };
        });

        // Auto-width Calculation (Simple Heuristic)
        worksheet.columns.forEach(column => {
            let maxLength = 0;
            if (column && column.eachCell) {
                column.eachCell({ includeEmpty: true }, (cell) => {
                    const columnLength = cell.value ? cell.value.toString().length : 10;
                    if (columnLength > maxLength) {
                        maxLength = columnLength;
                    }
                });
            }
            // Add a little padding
            column.width = maxLength < 10 ? 10 : maxLength + 2;
        });

        // Write buffer
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        FileSaver.saveAs(blob, `Nobet_Listesi_${selectedDate}.xlsx`);
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
                    <div className="text-sm text-gray-500">v17.1</div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                
                {/* Controls Section */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex flex-wrap gap-6 mb-6 items-end">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Ay Seçimi</label>
                            <input 
                                type="month" 
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Günlük Nöbetçi Sayısı</label>
                            <input 
                                type="number" 
                                min="1" 
                                max="10"
                                value={perDay}
                                onChange={(e) => setPerDay(parseInt(e.target.value) || 1)}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                            />
                        </div>
                        <div className="flex-grow"></div>
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className={`flex items-center justify-center px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white transition-colors
                                ${isGenerating ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}
                            `}
                        >
                            {isGenerating ? 'Oluşturuluyor...' : 'Listeyi Oluştur'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Quotas */}
                        <div className="flex flex-col h-full">
                            <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                1. Nöbet Sayısı (İsim: Sayı)
                            </label>
                            <textarea
                                className="flex-1 w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm font-mono p-3 border min-h-[200px]"
                                value={rawQuotas}
                                onChange={(e) => setRawQuotas(e.target.value)}
                                placeholder="Ahmet: 5..."
                            />
                        </div>

                        {/* Leaves */}
                        <div className="flex flex-col h-full">
                            <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                2. Nöbet Yazılamayacak Günler (İsim: 1, 5...)
                            </label>
                            <textarea
                                className="flex-1 w-full rounded-lg border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm font-mono p-3 border min-h-[200px]"
                                value={rawLeaves}
                                onChange={(e) => setRawLeaves(e.target.value)}
                                placeholder="Ahmet: 10, 11..."
                            />
                        </div>

                        {/* Requests */}
                        <div className="flex flex-col h-full">
                            <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                3. Nöbet İstekleri (İsim: 5, 20...)
                            </label>
                            <textarea
                                className="flex-1 w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 text-sm font-mono p-3 border min-h-[200px]"
                                value={rawRequests}
                                onChange={(e) => setRawRequests(e.target.value)}
                                placeholder="Ayşe: 5..."
                            />
                        </div>
                    </div>
                </div>

                {/* Results Section */}
                {result && (
                    <div className="space-y-8 animate-fade-in">
                        
                        {/* Logs / Warnings */}
                        {result.logs.length > 0 && (
                            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <AlertIcon />
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-yellow-800">İşlem Raporu</h3>
                                        <div className="mt-2 text-sm text-yellow-700">
                                            <ul className="list-disc pl-5 space-y-1">
                                                {result.logs.map((log, i) => (
                                                    <li key={i}>{log}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex justify-end">
                            <button
                                onClick={handleDownloadExcel}
                                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                <div className="mr-2 text-green-600">
                                    <DownloadIcon />
                                </div>
                                Excel Olarak İndir (.xlsx)
                            </button>
                        </div>

                        {/* Schedule Table */}
                        <ScheduleTable schedule={result.schedule} />

                        {/* Stats Chart */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <StatsChart data={result.stats} />
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}