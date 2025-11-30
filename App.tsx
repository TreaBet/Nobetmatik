
import React, { useState, useMemo, useRef } from 'react';
import { Scheduler } from './services/scheduler';
import { exportToExcel, generateTemplate, readStaffFromExcel } from './services/excelService';
import { Staff, Service, ScheduleResult, Role, Group, RoleConfig, DaySchedule } from './types';
import { ICONS, MOCK_STAFF, MOCK_SERVICES } from './constants';
import { Card, Button, Badge, MultiSelect } from './components/ui';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Moon, Sun, Monitor, Zap, Edit3, X, Save, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'staff' | 'services' | 'generate'>('staff');
  const [staff, setStaff] = useState<Staff[]>(MOCK_STAFF as unknown as Staff[]);
  const [services, setServices] = useState<Service[]>(MOCK_SERVICES as unknown as Service[]);
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Generator Config
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [monteCarloIters] = useState(1000); 
  const [randomizeDays, setRandomizeDays] = useState(true);
  const [preventEveryOther, setPreventEveryOther] = useState(true);
  const [isBlackAndWhite, setIsBlackAndWhite] = useState(false);
  
  // Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{day: number, serviceId: string, currentStaffId: string} | null>(null);

  // Form States
  const [newStaff, setNewStaff] = useState<Partial<Staff>>({ 
    name: '', role: 2, group: 'Genel', quotaService: 5, quotaEmergency: 2, weekendLimit: 2, offDays: [], requestedDays: []
  });
  const [newService, setNewService] = useState<Partial<Service>>({ 
    name: '', minDailyCount: 1, maxDailyCount: 1, allowedRoles: [1, 2, 3], priorityRoles: [], preferredGroup: 'Farketmez', isEmergency: false 
  });

  // Bulk Role Configuration State
  const uniqueRoles = useMemo(() => Array.from(new Set(staff.map(s => s.role))).sort((a: number, b: number) => a - b), [staff]);
  const [roleConfigs, setRoleConfigs] = useState<Record<number, RoleConfig>>({});

  const handleApplyRoleConfig = (role: number) => {
    const config = roleConfigs[role];
    if (!config) return;

    setStaff(prevStaff => prevStaff.map(s => {
      if (s.role === role) {
        return {
          ...s,
          quotaService: config.quotaService,
          quotaEmergency: config.quotaEmergency,
          weekendLimit: config.weekendLimit
        };
      }
      return s;
    }));
    alert(`Tüm Kıdem ${role} personelleri güncellendi.`);
  };

  const updateRoleConfig = (role: number, field: keyof RoleConfig, value: number) => {
     setRoleConfigs(prev => ({
         ...prev,
         [role]: {
             ...prev[role],
             role,
             [field]: value
         }
     }));
  };

  useMemo(() => {
     const newConfigs = {...roleConfigs};
     let changed = false;
     uniqueRoles.forEach(r => {
         if (!newConfigs[r]) {
             newConfigs[r] = { role: r, quotaService: 5, quotaEmergency: 2, weekendLimit: 2 };
             changed = true;
         }
     });
     if (changed) setRoleConfigs(newConfigs);
  }, [uniqueRoles]);


  const handleAddStaff = () => {
    if (!newStaff.name) return;
    setStaff([...staff, { ...newStaff, id: Date.now().toString() } as Staff]);
    setNewStaff({ name: '', role: 2, group: 'Genel', quotaService: 5, quotaEmergency: 2, weekendLimit: 2, offDays: [], requestedDays: [] });
  };

  const handleDeleteStaff = (id: string) => {
    setStaff(staff.filter(s => s.id !== id));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          try {
              const importedStaff = await readStaffFromExcel(e.target.files[0]);
              setStaff(importedStaff);
              alert(`${importedStaff.length} personel yüklendi. Şimdi 'Kıdem Bazlı Ayarlar' bölümünden nöbet sayılarını belirleyin.`);
          } catch (error) {
              alert('Dosya okunurken hata oluştu.');
          }
      }
  };

  const handleAddService = () => {
    if (!newService.name) return;
    setServices([...services, { ...newService, id: Date.now().toString() } as Service]);
    setNewService({ name: '', minDailyCount: 1, maxDailyCount: 1, allowedRoles: [1, 2, 3], priorityRoles: [], preferredGroup: 'Farketmez', isEmergency: false });
  };

  const handleDeleteService = (id: string) => {
    setServices(services.filter(s => s.id !== id));
  };

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);

    setTimeout(() => {
      try {
        const scheduler = new Scheduler(staff, services, {
          year,
          month,
          maxRetries: monteCarloIters,
          randomizeOrder: randomizeDays,
          preventEveryOtherDay: preventEveryOther
        });
        const res = scheduler.generate();
        setResult(res);
        setActiveTab('generate');
      } catch (e) {
        alert("Çizelge oluşturulamadı. Lütfen kısıtlamaları (günlük kişi sayısı vs.) ve personel kotalarını kontrol edin.");
      } finally {
        setLoading(false);
      }
    }, 100);
  };

  const handleDownload = () => {
    if (result) {
      exportToExcel(result, services, year, month);
    }
  };

  // --- MANUAL EDITING LOGIC ---
  const recalculateStats = (newSchedule: DaySchedule[]) => {
      if(!result) return;

      const newStats = staff.map(s => {
          let total = 0, serviceCount = 0, emergency = 0, weekend = 0, sat = 0, sun = 0;
          
          newSchedule.forEach(day => {
              const assignment = day.assignments.find(a => a.staffId === s.id);
              if(assignment) {
                  total++;
                  if(assignment.isEmergency) emergency++; else serviceCount++;
                  if(day.isWeekend) weekend++;
                  const date = new Date(year, month, day.day);
                  if(date.getDay() === 6) sat++;
                  if(date.getDay() === 0) sun++;
              }
          });

          return {
            staffId: s.id,
            totalShifts: total,
            serviceShifts: serviceCount,
            emergencyShifts: emergency,
            weekendShifts: weekend,
            saturdayShifts: sat,
            sundayShifts: sun
          };
      });

      const unfilled = newSchedule.reduce((acc, day) => acc + day.assignments.filter(a => a.staffId === 'EMPTY').length, 0);

      setResult({
          ...result,
          schedule: newSchedule,
          stats: newStats,
          unfilledSlots: unfilled
      });
  };

  const handleUpdateAssignment = (newStaffId: string) => {
      if (!editingSlot || !result) return;
      
      const newSchedule = [...result.schedule];
      const dayData = newSchedule.find(d => d.day === editingSlot.day);
      if(!dayData) return;

      const targetAssignmentIndex = dayData.assignments.findIndex(a => a.serviceId === editingSlot.serviceId && a.staffId === editingSlot.currentStaffId);
      if(targetAssignmentIndex === -1) return;

      const newStaffMember = staff.find(s => s.id === newStaffId);
      const isRemoving = newStaffId === 'EMPTY';

      const updatedAssignment = {
          ...dayData.assignments[targetAssignmentIndex],
          staffId: isRemoving ? 'EMPTY' : newStaffMember!.id,
          staffName: isRemoving ? 'BOŞ' : newStaffMember!.name,
          role: isRemoving ? 0 : newStaffMember!.role,
          group: isRemoving ? 'Genel' : newStaffMember!.group
      };

      dayData.assignments[targetAssignmentIndex] = updatedAssignment as any;
      recalculateStats(newSchedule);
      setEditingSlot(null);
  };

  const getAvailableStaffForEdit = () => {
      if(!editingSlot || !result) return [];
      
      const daySchedule = result.schedule.find(s => s.day === editingSlot.day);
      const service = services.find(s => s.id === editingSlot.serviceId);
      
      if(!daySchedule || !service) return [];

      const assignedStaffIds = new Set(daySchedule.assignments.map(a => a.staffId));
      
      return staff.filter(s => {
          if (assignedStaffIds.has(s.id) && s.id !== editingSlot.currentStaffId) return false;
          if (!service.allowedRoles.includes(s.role)) return false;
          if (s.offDays.includes(editingSlot.day)) return false;
          return true;
      });
  };

  const chartData = useMemo(() => {
    if (!result) return [];
    return result.stats.map(s => {
      const p = staff.find(st => st.id === s.staffId);
      return {
        name: p?.name || '?',
        targetService: p?.quotaService || 0,
        actualService: s.serviceShifts,
        targetEmergency: p?.quotaEmergency || 0,
        actualEmergency: s.emergencyShifts
      };
    });
  }, [result, staff]);

  return (
    <div className={`min-h-screen font-sans pb-20 transition-all duration-300 ${isBlackAndWhite ? 'bg-white text-black' : 'bg-gray-50 text-gray-800'}`}>
      
      {/* Modal for Manual Edit */}
      {editingSlot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border-2 border-gray-800">
                  <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                      <h3 className="font-bold text-gray-900">Nöbet Değiştir (Gün: {editingSlot.day})</h3>
                      <button onClick={() => setEditingSlot(null)}><X className="w-5 h-5 text-gray-600" /></button>
                  </div>
                  <div className="p-4 max-h-[60vh] overflow-y-auto">
                      <div className="space-y-2">
                          <button 
                             onClick={() => handleUpdateAssignment('EMPTY')}
                             className="w-full p-3 text-left border rounded hover:bg-red-50 hover:border-red-200 flex justify-between items-center text-red-600 font-bold"
                          >
                              <span>BOŞ BIRAK</span>
                              <X className="w-4 h-4" />
                          </button>
                          {getAvailableStaffForEdit().map(s => (
                              <button 
                                key={s.id}
                                onClick={() => handleUpdateAssignment(s.id)}
                                className={`w-full p-3 text-left border rounded hover:bg-blue-50 hover:border-blue-200 flex justify-between items-center ${s.id === editingSlot.currentStaffId ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : ''}`}
                              >
                                  <div>
                                      <div className="font-medium text-gray-900">{s.name}</div>
                                      <div className="text-xs text-gray-500">Kıdem: {s.role} | Grup: {s.group}</div>
                                  </div>
                                  {s.id === editingSlot.currentStaffId && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                              </button>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Header */}
      <header className={`border-b sticky top-0 z-30 shadow-sm ${isBlackAndWhite ? 'bg-black border-black' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isBlackAndWhite ? 'bg-white text-black' : 'bg-brand-600 text-white'}`}>
                {ICONS.Shield}
              </div>
              <div className={isBlackAndWhite ? 'text-white' : ''}>
                <h1 className="text-xl font-bold leading-none">Nöbetmatik v20</h1>
                <span className={`text-xs font-semibold tracking-wide ${isBlackAndWhite ? 'text-gray-300' : 'text-brand-600'}`}>ENTERPRISE EDITION</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <nav className={`flex space-x-1 p-1 rounded-lg ${isBlackAndWhite ? 'bg-gray-800' : 'bg-gray-100'}`}>
                {(['staff', 'services', 'generate'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === tab 
                        ? (isBlackAndWhite ? 'bg-white text-black font-bold' : 'bg-white text-brand-700 shadow-sm') 
                        : (isBlackAndWhite ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700')
                    }`}
                  >
                    {tab === 'staff' && 'Personel'}
                    {tab === 'services' && 'Servis & Kurallar'}
                    {tab === 'generate' && 'Çizelge & Rapor'}
                  </button>
                ))}
              </nav>
              <button 
                onClick={() => setIsBlackAndWhite(!isBlackAndWhite)}
                className={`p-2 rounded-full transition-colors ${isBlackAndWhite ? 'bg-white text-black' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                title={isBlackAndWhite ? "Normal Moda Geç" : "Yüksek Kontrast Moduna Geç"}
              >
                 {isBlackAndWhite ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* STAFF TAB */}
        {activeTab === 'staff' && (
          <div className="space-y-6">
            {/* ... Staff content remains mostly same, just checking high-contrast classes ... */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-4">
              <div>
                <h2 className="text-2xl font-bold">Personel Yönetimi</h2>
                <p className="opacity-70 mt-1">Excel'den toplu yükleyin veya manuel ekleyin. Kıdem bazlı kurallar tanımlayın.</p>
              </div>
              <div className="flex gap-2">
                 <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                 <Button variant="secondary" onClick={generateTemplate} className={isBlackAndWhite ? 'border-black text-black' : ''}>
                    {ICONS.Template} Taslak İndir
                 </Button>
                 <Button variant="primary" onClick={() => fileInputRef.current?.click()} className={isBlackAndWhite ? '!bg-black' : ''}>
                    {ICONS.Upload} Excel'den Yükle
                 </Button>
              </div>
            </div>

            {/* Role Configs */}
            {staff.length > 0 && (
                <Card className={`p-4 border ${isBlackAndWhite ? 'bg-white border-black' : 'bg-blue-50 border-blue-100'}`}>
                    <div className={`mb-3 flex items-center gap-2 ${isBlackAndWhite ? 'text-black' : 'text-blue-900'}`}>
                        {ICONS.Settings}
                        <h3 className="font-bold">Kıdem Bazlı Toplu Ayarlar</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {uniqueRoles.map(role => (
                            <div key={role} className={`p-3 rounded-lg shadow-sm border ${isBlackAndWhite ? 'bg-white border-black' : 'bg-white border-blue-100'}`}>
                                <div className="font-bold mb-2 border-b pb-1 flex justify-between">
                                    <span>Kıdem {role}</span>
                                    <span className="text-xs opacity-50 font-normal">Bu kıdemde {staff.filter(s => s.role === role).length} kişi var</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    <div>
                                        <label className="text-[10px] uppercase font-bold opacity-60">Servis</label>
                                        <input 
                                            type="number" 
                                            className={`w-full text-center border rounded p-1 text-sm ${isBlackAndWhite ? 'border-black' : ''}`}
                                            value={roleConfigs[role]?.quotaService || 0}
                                            onChange={(e) => updateRoleConfig(role, 'quotaService', parseInt(e.target.value))}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold opacity-60">Acil</label>
                                        <input 
                                            type="number" 
                                            className={`w-full text-center border rounded p-1 text-sm ${isBlackAndWhite ? 'border-black' : ''}`}
                                            value={roleConfigs[role]?.quotaEmergency || 0}
                                            onChange={(e) => updateRoleConfig(role, 'quotaEmergency', parseInt(e.target.value))}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold opacity-60">H.Sonu</label>
                                        <input 
                                            type="number" 
                                            className={`w-full text-center border rounded p-1 text-sm ${isBlackAndWhite ? 'border-black' : ''}`}
                                            value={roleConfigs[role]?.weekendLimit || 0}
                                            onChange={(e) => updateRoleConfig(role, 'weekendLimit', parseInt(e.target.value))}
                                        />
                                    </div>
                                </div>
                                <Button variant="secondary" className={`w-full justify-center text-xs py-1 ${isBlackAndWhite ? 'bg-black text-white border-none hover:bg-gray-800' : ''}`} onClick={() => handleApplyRoleConfig(role)}>
                                    Uygula
                                </Button>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Manual Add Form */}
            <Card className={`p-4 border-l-4 ${isBlackAndWhite ? 'border-black' : 'border-l-gray-400'}`}>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                {/* Inputs omitted for brevity, logic unchanged */}
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium mb-1">Manuel Ekle: Ad Soyad</label>
                  <input 
                    type="text" 
                    value={newStaff.name} 
                    onChange={e => setNewStaff({...newStaff, name: e.target.value})}
                    className="w-full border-gray-300 rounded-lg shadow-sm p-2 border" 
                    placeholder="Örn: Dr. Ahmet"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1">Kıdem</label>
                  <input type="number" min="1" max="10" value={newStaff.role} onChange={e => setNewStaff({...newStaff, role: parseInt(e.target.value)})} className="w-full border-gray-300 rounded-lg shadow-sm p-2 border" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1">Grup</label>
                  <select value={newStaff.group} onChange={e => setNewStaff({...newStaff, group: e.target.value as Group})} className="w-full border-gray-300 rounded-lg shadow-sm p-2 border">
                    <option value="Genel">Genel</option><option value="A">A Grubu</option><option value="B">B Grubu</option><option value="C">C Grubu</option><option value="D">D Grubu</option>
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium mb-1">Hedefler (Srv / Acil / HS)</label>
                  <div className="flex gap-1">
                    <input type="number" value={newStaff.quotaService} onChange={e => setNewStaff({...newStaff, quotaService: parseInt(e.target.value)})} className="w-1/3 border-gray-300 rounded-lg shadow-sm p-2 border text-center" />
                    <input type="number" value={newStaff.quotaEmergency} onChange={e => setNewStaff({...newStaff, quotaEmergency: parseInt(e.target.value)})} className="w-1/3 border-gray-300 rounded-lg shadow-sm p-2 border text-center" />
                    <input type="number" value={newStaff.weekendLimit} onChange={e => setNewStaff({...newStaff, weekendLimit: parseInt(e.target.value)})} className="w-1/3 border-gray-300 rounded-lg shadow-sm p-2 border text-center" />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Button onClick={handleAddStaff} className={`w-full justify-center ${isBlackAndWhite ? '!bg-black' : ''}`}>
                    {ICONS.UserPlus} Ekle
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className={isBlackAndWhite ? 'bg-black text-white' : 'bg-gray-50'}>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase">Personel</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase">Kıdem & Grup</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase">Hedefler</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase">İzin (Off)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase">İstek</th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {staff.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap"><div className="font-medium">{p.name}</div></td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-2">
                            <Badge color={isBlackAndWhite ? "gray" : "purple"}>Kıdem {p.role}</Badge>
                            <Badge color="gray">{p.group}</Badge>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm opacity-80">
                           {p.quotaService} / {p.quotaEmergency} / {p.weekendLimit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                             <div className={`rounded px-2 py-1 flex items-center gap-1 border ${isBlackAndWhite ? 'bg-white border-black' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                {ICONS.Calendar}
                                <input 
                                  type="text" 
                                  className="bg-transparent border-none outline-none w-24 text-xs font-medium placeholder-gray-400"
                                  placeholder="Örn: 1,5"
                                  value={p.offDays.join(',')}
                                  onChange={(e) => {
                                    const days = e.target.value.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
                                    setStaff(staff.map(s => s.id === p.id ? { ...s, offDays: days } : s));
                                  }}
                                />
                             </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                           {/* Requested days logic same as before */}
                           <div className={`rounded px-2 py-1 flex items-center gap-1 border ${isBlackAndWhite ? 'bg-white border-black' : 'bg-green-50 text-green-600 border-green-100'}`}>
                                {ICONS.Heart}
                                <input 
                                  type="text" 
                                  className="bg-transparent border-none outline-none w-24 text-xs font-medium placeholder-gray-400"
                                  placeholder="Örn: 15"
                                  value={p.requestedDays ? p.requestedDays.join(',') : ''}
                                  onChange={(e) => {
                                      const days = e.target.value.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
                                      setStaff(staff.map(s => s.id === p.id ? { ...s, requestedDays: days } : s));
                                  }}
                                />
                             </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button onClick={() => handleDeleteStaff(p.id)} className="opacity-50 hover:opacity-100 hover:bg-gray-100 p-1 rounded">{ICONS.Trash}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* SERVICES TAB */}
        {activeTab === 'services' && (
          <div className="space-y-6">
             {/* Service inputs same as before */}
             <div className="flex justify-between items-end">
              <div><h2 className="text-2xl font-bold">Servis Kuralları</h2></div>
            </div>
            <Card className={`p-4 border-l-4 ${isBlackAndWhite ? 'border-l-black' : 'border-l-brand-500'}`}>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-start">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1">Servis Adı</label>
                  <input type="text" value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} className="w-full border-gray-300 rounded-lg shadow-sm p-2 border" placeholder="Örn: Acil" />
                  <div className="mt-2 flex items-center gap-2">
                      <input type="checkbox" id="isEmerg" checked={newService.isEmergency} onChange={e => setNewService({...newService, isEmergency: e.target.checked})} className={`rounded focus:ring-brand-500 ${isBlackAndWhite ? 'text-black' : 'text-brand-600'}`} />
                      <label htmlFor="isEmerg" className={`text-sm font-medium ${isBlackAndWhite ? 'text-black' : 'text-red-600'}`}>Bu bir Acil Nöbetidir</label>
                  </div>
                </div>
                <div>
                   <label className="block text-xs font-medium mb-1">Min-Max Kişi</label>
                   <div className="flex gap-2">
                       <input type="number" value={newService.minDailyCount} onChange={e => setNewService({...newService, minDailyCount: parseInt(e.target.value)})} className="w-1/2 p-2 border rounded" placeholder="Min" />
                       <input type="number" value={newService.maxDailyCount} onChange={e => setNewService({...newService, maxDailyCount: parseInt(e.target.value)})} className="w-1/2 p-2 border rounded" placeholder="Max" />
                   </div>
                </div>
                <div className="md:col-span-2 space-y-2">
                   <MultiSelect label="Yazılabilir Kıdemler" options={uniqueRoles} selected={newService.allowedRoles || []} onChange={(vals) => setNewService({...newService, allowedRoles: vals})} />
                   <MultiSelect label="Öncelikli Kıdemler" options={uniqueRoles} selected={newService.priorityRoles || []} onChange={(vals) => setNewService({...newService, priorityRoles: vals})} />
                </div>
                 <div>
                  <label className="block text-xs font-medium mb-1">Öncelikli Grup</label>
                  <select value={newService.preferredGroup} onChange={e => setNewService({...newService, preferredGroup: e.target.value as any})} className="w-full border-gray-300 rounded-lg shadow-sm p-2 border">
                    <option value="Farketmez">Farketmez</option><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                  </select>
                </div>
                <div className="md:col-span-6 flex justify-end">
                  <Button onClick={handleAddService} className={`w-48 justify-center ${isBlackAndWhite ? '!bg-black' : ''}`}>{ICONS.Plus} Servisi Ekle</Button>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map(s => (
                <Card key={s.id} className={`p-4 relative hover:shadow-md transition-shadow border-l-4 ${isBlackAndWhite ? 'border-l-black' : (s.isEmergency ? 'border-l-red-500' : 'border-l-blue-500')}`}>
                  <button onClick={() => handleDeleteService(s.id)} className="absolute top-3 right-3 opacity-50 hover:opacity-100 hover:text-red-500">{ICONS.Trash}</button>
                  <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg">{s.name}</h3>
                      {s.isEmergency && <Badge color={isBlackAndWhite ? "gray" : "red"}>Acil</Badge>}
                  </div>
                  <div className="mt-3 space-y-2 text-sm opacity-80">
                     <div className="flex justify-between"><span>Kişi:</span><span className="font-semibold">{s.minDailyCount}-{s.maxDailyCount}</span></div>
                     <div className="flex justify-between"><span>Roller:</span><span className="text-[10px]">{s.allowedRoles.join(',')}</span></div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* GENERATE TAB */}
        {activeTab === 'generate' && (
          <div className={`space-y-6 ${isBlackAndWhite ? 'high-contrast' : ''}`}>
            
            <Card className={`p-6 border-none ${isBlackAndWhite ? 'bg-black text-white' : 'bg-brand-900 text-white'}`}>
              <div className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                  <div>
                    <h2 className="text-2xl font-bold">Nöbet Çizelgesi Oluştur</h2>
                    <p className="opacity-80 mt-1">Simülasyon ve optimizasyon.</p>
                  </div>
                  <div className="flex items-center gap-4 bg-white/10 p-2 rounded-xl backdrop-blur-sm">
                      {/* Month/Year Selects */}
                      <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className={`border border-white/30 rounded-lg p-2 focus:ring-2 focus:ring-white outline-none ${isBlackAndWhite ? 'bg-black text-white' : 'bg-brand-800 text-white'}`}>
                        {Array.from({length: 12}, (_, i) => <option key={i} value={i} className="text-black">{new Date(0, i).toLocaleString('tr-TR', {month: 'long'})}</option>)}
                      </select>
                      <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className={`border border-white/30 rounded-lg p-2 focus:ring-2 focus:ring-white outline-none ${isBlackAndWhite ? 'bg-black text-white' : 'bg-brand-800 text-white'}`}>
                        {[2024, 2025, 2026].map(y => <option key={y} value={y} className="text-black">{y}</option>)}
                      </select>
                      <Button onClick={handleGenerate} disabled={loading} className={`shadow-none border-none ${isBlackAndWhite ? 'bg-white text-black hover:bg-gray-200' : 'bg-white text-brand-900 hover:bg-brand-50'}`}>
                        {loading ? 'Hesaplanıyor...' : 'Oluştur'}
                      </Button>
                  </div>
                </div>
                {/* Checkboxes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/20 pt-4">
                    <div className="flex items-center gap-2">
                         <input type="checkbox" checked={randomizeDays} onChange={(e) => setRandomizeDays(e.target.checked)} className="rounded bg-white/20 border-white/30 text-brand-600 focus:ring-brand-500" />
                         <label className="text-sm cursor-pointer">Rastgele Gün Dağıtımı</label>
                    </div>
                    <div className="flex items-center gap-2">
                         <input type="checkbox" checked={preventEveryOther} onChange={(e) => setPreventEveryOther(e.target.checked)} className="rounded bg-white/20 border-white/30 text-brand-600 focus:ring-brand-500" />
                         <label className="text-sm cursor-pointer">Günaşırı Koruması</label>
                    </div>
                </div>
              </div>
            </Card>
            
            {result && (
              <>
                {/* Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className={`p-4 border-l-4 ${isBlackAndWhite ? 'border-l-gray-600' : 'border-l-green-500'}`}>
                     <div className="text-sm opacity-70">Toplam Atama</div>
                     <div className="text-2xl font-bold">
                       {result.schedule.reduce((acc, day) => acc + day.assignments.filter(a => a.staffId !== 'EMPTY').length, 0)}
                     </div>
                  </Card>
                  <Card className={`p-4 border-l-4 ${isBlackAndWhite ? 'border-l-gray-900' : 'border-l-red-500'}`}>
                     <div className="text-sm opacity-70">Boş Kalan</div>
                     <div className={`text-2xl font-bold ${isBlackAndWhite ? '' : 'text-red-600'}`}>
                       {result.unfilledSlots}
                     </div>
                  </Card>
                  {result.logs.length > 0 ? (
                      <Card className={`p-4 border-l-4 cursor-pointer hover:opacity-80 ${isBlackAndWhite ? 'bg-gray-100 border-l-black' : 'border-l-yellow-500 hover:bg-yellow-50'}`} onClick={() => document.getElementById('log-section')?.scrollIntoView({behavior: 'smooth'})}>
                         <div className="text-sm opacity-70 flex items-center gap-2">{ICONS.Alert} Uyarılar</div>
                         <div className={`text-2xl font-bold ${isBlackAndWhite ? '' : 'text-yellow-600'}`}>{result.logs.length} adet</div>
                      </Card>
                  ) : (
                      <Card className={`p-4 border-l-4 ${isBlackAndWhite ? 'border-l-black' : 'border-l-blue-500'}`}>
                         <div className="text-sm opacity-70">Durum</div>
                         <div className={`text-2xl font-bold ${isBlackAndWhite ? '' : 'text-blue-600'}`}>Sorunsuz</div>
                      </Card>
                  )}
                  <Card className="p-0 flex items-center justify-center bg-gray-50">
                     <Button variant="secondary" onClick={handleDownload} className="w-full h-full justify-center border-none">
                       {ICONS.Excel} Excel Olarak İndir
                     </Button>
                  </Card>
                </div>
                
                {/* Logs */}
                {result.logs.length > 0 && (
                    <Card className={isBlackAndWhite ? 'bg-white border-black border-2' : 'bg-yellow-50 border-yellow-200'} id="log-section">
                        <div className={`p-4 border-b font-bold flex items-center gap-2 ${isBlackAndWhite ? 'border-black' : 'border-yellow-200 text-yellow-800'}`}>
                            {ICONS.Alert} Sistem Logları ve Hatalar
                        </div>
                        <div className={`p-4 max-h-48 overflow-y-auto text-sm font-mono space-y-1 ${isBlackAndWhite ? 'text-black' : 'text-yellow-900'}`}>
                            {result.logs.map((log, i) => <div key={i}>• {log}</div>)}
                        </div>
                    </Card>
                )}

                {/* Chart */}
                <Card className="p-6">
                  <h3 className="font-bold mb-4">Hedef Tutarlılığı</h3>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{fontSize: 11, fill: 'black'}} interval={0} angle={-45} textAnchor="end" height={60} />
                        <YAxis tick={{ fill: 'black' }}/>
                        <Tooltip />
                        <Legend verticalAlign="top"/>
                        <Bar dataKey="targetService" name="Hedef (Srv)" fill={isBlackAndWhite ? '#d1d5db' : '#e2e8f0'} stroke="black" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="actualService" name="Gerçekleşen (Srv)" fill={isBlackAndWhite ? 'black' : '#3b82f6'} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="targetEmergency" name="Hedef (Acil)" fill={isBlackAndWhite ? '#9ca3af' : '#fee2e2'} stroke="black" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="actualEmergency" name="Gerçekleşen (Acil)" fill={isBlackAndWhite ? 'url(#stripePattern)' : '#ef4444'} stroke="black" radius={[4, 4, 0, 0]} />
                         <defs>
                            <pattern id="stripePattern" patternUnits="userSpaceOnUse" width="4" height="4">
                              <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" style={{stroke:'black', strokeWidth:1}} />
                            </pattern>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                {/* Main Schedule Table with strictly enforced styles */}
                <Card className="report-table-container">
                  <div className="p-3 bg-gray-50 border-b flex justify-between items-center sticky left-0 z-30">
                      <span className="text-xs font-bold uppercase opacity-60 ml-2">Çizelge Detayı</span>
                      <Button variant="ghost" onClick={() => setIsEditing(!isEditing)} className={isEditing ? 'bg-blue-100 text-blue-800' : ''}>
                          {isEditing ? <Save className="w-4 h-4"/> : <Edit3 className="w-4 h-4"/>}
                          {isEditing ? 'Bitti' : 'Düzenle'}
                      </Button>
                  </div>
                  
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th className="sticky-col w-24">Gün</th>
                        {services.map(s => (
                          <th key={s.id} className="w-40">
                              <div className="truncate">{s.name}</div>
                              <div className="text-[9px] font-normal opacity-70">Min:{s.minDailyCount}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.schedule.map((day) => (
                        <tr key={day.day} className={day.isWeekend ? 'is-weekend' : ''}>
                          <td className="sticky-col align-middle">
                            <div className="flex flex-col items-center justify-center h-full">
                              <span className="text-lg font-bold">{day.day}</span>
                              <span className="text-[10px] uppercase">
                                {new Date(year, month, day.day).toLocaleString('tr-TR', {weekday: 'short'})}
                              </span>
                            </div>
                          </td>
                          {services.map(service => {
                            const assignments = day.assignments.filter(a => a.serviceId === service.id);
                            return (
                              <td key={service.id}>
                                <div className="flex flex-col gap-1 min-h-[40px]">
                                    {assignments.length > 0 ? assignments.map((a, idx) => {
                                      let badgeClass = 'slot-normal';
                                      if (a.staffId === 'EMPTY') badgeClass = 'slot-empty';
                                      else if (a.isEmergency) badgeClass = 'slot-emergency';
                                      
                                      return (
                                        <div 
                                          key={idx} 
                                          onClick={() => isEditing && setEditingSlot({day: day.day, serviceId: service.id, currentStaffId: a.staffId})}
                                          className={`slot-badge ${badgeClass} ${isEditing ? 'clickable' : ''}`}
                                        >
                                          <span className="font-semibold block truncate">{a.staffName}</span>
                                          {a.staffId !== 'EMPTY' && <span className="opacity-75 text-[9px] block">K:{a.role}</span>}
                                        </div>
                                      );
                                    }) : (
                                      <span className="text-gray-300 text-center text-xs block py-2">-</span>
                                    )}
                                  </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
