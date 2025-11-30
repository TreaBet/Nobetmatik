
import * as XLSX from 'xlsx';
import { ScheduleResult, Service, Staff, Group } from '../types';

// Mevcut Excel Dışa Aktarma
export const exportToExcel = (result: ScheduleResult, services: Service[], year: number, month: number) => {
  const wb = XLSX.utils.book_new();
  const monthName = new Date(year, month).toLocaleString('tr-TR', { month: 'long' });

  // 1. Main Schedule
  const headers = ['Gün', ...services.map(s => s.name)];
  const data: any[] = [];

  result.schedule.forEach(daySchedule => {
    const row: any = {
      'Gün': `${daySchedule.day} ${monthName}`
    };

    services.forEach(service => {
      const assignments = daySchedule.assignments.filter(a => a.serviceId === service.id);
      
      if (assignments.length > 0) {
          row[service.name] = assignments.map(a => a.staffName).join(', ');
      } else {
          row[service.name] = '-';
      }
    });

    data.push(row);
  });

  const ws = XLSX.utils.json_to_sheet(data, { header: headers });
  const wscols = headers.map(h => ({ wch: Math.max(h.length + 5, 20) }));
  ws['!cols'] = wscols;
  XLSX.utils.book_append_sheet(wb, ws, "Nöbet Listesi");

  // 2. Statistics
  const statsData = result.stats.map(s => ({
      'Personel ID': s.staffId,
      'Toplam Nöbet': s.totalShifts,
      'Servis Nöbeti': s.serviceShifts,
      'Acil Nöbeti': s.emergencyShifts,
      'Hafta Sonu': s.weekendShifts,
      'Cmt': s.saturdayShifts,
      'Paz': s.sundayShifts
  }));
  const wsStats = XLSX.utils.json_to_sheet(statsData);
  XLSX.utils.book_append_sheet(wb, wsStats, "İstatistikler");

  // 3. Logs
  if (result.logs && result.logs.length > 0) {
      const logData = result.logs.map(l => ({ 'Hata Kaydı': l }));
      const wsLogs = XLSX.utils.json_to_sheet(logData);
      XLSX.utils.book_append_sheet(wb, wsLogs, "Hata Logları");
  }

  // Download
  XLSX.writeFile(wb, `Nobet_Listesi_${monthName}_${year}.xlsx`);
};

// Taslak Excel Oluşturma
export const generateTemplate = () => {
    const wb = XLSX.utils.book_new();
    const headers = ['Ad Soyad', 'Kıdem', 'Grup'];
    const exampleData = [
        { 'Ad Soyad': 'Dr. Örnek Kişi', 'Kıdem': 1, 'Grup': 'A' },
        { 'Ad Soyad': 'Dr. İkinci Kişi', 'Kıdem': 2, 'Grup': 'B' },
        { 'Ad Soyad': 'Dr. Üçüncü Kişi', 'Kıdem': 3, 'Grup': 'Genel' }
    ];

    const ws = XLSX.utils.json_to_sheet(exampleData, { header: headers });
    XLSX.utils.book_append_sheet(wb, ws, "Personel Listesi");
    XLSX.writeFile(wb, "Personel_Yukleme_Taslagi.xlsx");
};

// Excel'den Personel Okuma
export const readStaffFromExcel = async (file: File): Promise<Staff[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const wb = XLSX.read(data, { type: 'binary' });
                const sheetName = wb.SheetNames[0];
                const worksheet = wb.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);

                const staffList: Staff[] = json.map((row: any, index) => ({
                    id: `imp_${Date.now()}_${index}`,
                    name: row['Ad Soyad'] || row['name'] || 'İsimsiz',
                    role: parseInt(row['Kıdem'] || row['role'] || '3'),
                    group: (row['Grup'] || row['group'] || 'Genel') as Group,
                    // Varsayılan değerler, daha sonra arayüzden toplu güncellenecek
                    quotaService: 0, 
                    quotaEmergency: 0,
                    weekendLimit: 0,
                    offDays: [],
                    requestedDays: []
                }));

                resolve(staffList);
            } catch (error) {
                reject(error);
            }
        };
        reader.readAsBinaryString(file);
    });
};
