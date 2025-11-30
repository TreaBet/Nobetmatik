
import React from 'react';
import { Users, Calendar, Settings, ShieldCheck, Download, Trash2, Plus, UserPlus, FileSpreadsheet, AlertTriangle, CheckSquare, Heart, Upload, FileDown } from 'lucide-react';

export const ICONS = {
    Users: <Users className="w-5 h-5" />,
    Calendar: <Calendar className="w-5 h-5" />,
    Settings: <Settings className="w-5 h-5" />,
    Shield: <ShieldCheck className="w-5 h-5" />,
    Download: <Download className="w-5 h-5" />,
    Upload: <Upload className="w-4 h-4" />,
    Template: <FileDown className="w-4 h-4" />,
    Trash: <Trash2 className="w-4 h-4" />,
    Plus: <Plus className="w-4 h-4" />,
    UserPlus: <UserPlus className="w-5 h-5" />,
    Excel: <FileSpreadsheet className="w-5 h-5" />,
    Alert: <AlertTriangle className="w-5 h-5" />,
    Check: <CheckSquare className="w-4 h-4" />,
    Heart: <Heart className="w-4 h-4" />
};

export const MOCK_STAFF = [
  { id: '1', name: 'Dr. Ahmet Yılmaz', role: 1, group: 'A', quotaService: 5, quotaEmergency: 2, weekendLimit: 2, offDays: [], requestedDays: [] },
  { id: '2', name: 'Dr. Ayşe Demir', role: 1, group: 'B', quotaService: 5, quotaEmergency: 2, weekendLimit: 2, offDays: [5, 6], requestedDays: [] },
  { id: '3', name: 'Dr. Mehmet Kaya', role: 2, group: 'A', quotaService: 6, quotaEmergency: 3, weekendLimit: 3, offDays: [], requestedDays: [15, 16] },
  { id: '4', name: 'Dr. Zeynep Çelik', role: 2, group: 'C', quotaService: 6, quotaEmergency: 3, weekendLimit: 3, offDays: [], requestedDays: [] },
  { id: '5', name: 'Dr. Ali Vural', role: 3, group: 'B', quotaService: 4, quotaEmergency: 6, weekendLimit: 4, offDays: [], requestedDays: [] },
  { id: '6', name: 'Dr. Elif Şahin', role: 3, group: 'C', quotaService: 4, quotaEmergency: 6, weekendLimit: 4, offDays: [], requestedDays: [] },
  { id: '7', name: 'Dr. Burak Can', role: 1, group: 'D', quotaService: 4, quotaEmergency: 2, weekendLimit: 1, offDays: [], requestedDays: [] },
  { id: '8', name: 'Dr. Gamze Ak', role: 2, group: 'D', quotaService: 6, quotaEmergency: 3, weekendLimit: 3, offDays: [], requestedDays: [] },
  { id: '9', name: 'Dr. Caner Erkin', role: 3, group: 'A', quotaService: 4, quotaEmergency: 7, weekendLimit: 4, offDays: [], requestedDays: [] },
] as const;

export const MOCK_SERVICES = [
  { id: 's1', name: 'Acil Servis', minDailyCount: 2, maxDailyCount: 3, allowedRoles: [2, 3], preferredGroup: 'Farketmez', isEmergency: true },
  { id: 's2', name: 'Acil Müşahade', minDailyCount: 1, maxDailyCount: 1, allowedRoles: [3], preferredGroup: 'Farketmez', isEmergency: true },
  { id: 's3', name: 'Poliklinik', minDailyCount: 1, maxDailyCount: 1, allowedRoles: [1, 2], preferredGroup: 'Farketmez', isEmergency: false },
  { id: 's4', name: 'Yoğun Bakım', minDailyCount: 1, maxDailyCount: 1, allowedRoles: [1], preferredGroup: 'A', isEmergency: false },
] as const;
