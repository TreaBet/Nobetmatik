import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Statistics } from '../types';

interface Props {
    data: Statistics[];
}

export const StatsChart: React.FC<Props> = ({ data }) => {
    return (
        <div className="h-80 w-full mt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">İş Yükü Dağılımı</h3>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={data}
                    margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 5,
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{fontSize: 12}} interval={0} />
                    <YAxis />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    />
                    <Legend />
                    <Bar dataKey="assigned" name="Toplam Nöbet" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.assigned > entry.target ? '#ef4444' : '#3b82f6'} />
                        ))}
                    </Bar>
                    <Bar dataKey="weekendShifts" name="Hafta Sonu" fill="#f97316" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="target" name="Hedef Nöbet Sayısı" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};