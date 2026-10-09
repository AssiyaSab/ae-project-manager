import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ru } from 'date-fns/locale';
import { formatDate } from '@/lib/formatters';

export default function TripsTab({ currentUser, projects, users }: any) {
  const [trips, setTrips] = useState<any[]>([]);
  
  const [tripEmployee, setTripEmployee] = useState('');
  const [tripDest, setTripDest] = useState('');
  const [tripPurpose, setTripPurpose] = useState('');
  const [tripStart, setTripStart] = useState('');
  const [tripEnd, setTripEnd] = useState('');
  const [tripBudget, setTripBudget] = useState('');
  const [tripProject, setTripProject] = useState('');

  const [editingTrip, setEditingTrip] = useState<any>(null);

  const pass = typeof window !== 'undefined' ? localStorage.getItem('ae_admin_password') : '';

  const fetchData = async () => {
    if (!pass && currentUser?.role !== 'ENGINEER' && currentUser?.role !== 'ASSEMBLER') return;
    try {
      const headers = { 
        'x-auth-password': pass || '',
        'x-auth-login': localStorage.getItem('ae_auth_login') || ''
      };
      const res = await fetch('/api/trips', { headers });
      const tRes = await res.json();
      if (Array.isArray(tRes)) setTrips(tRes);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [pass]);

  const handleTripSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-password': pass || '', 'x-auth-login': localStorage.getItem('ae_auth_login') || '' },
        body: JSON.stringify({
          employeeId: tripEmployee,
          destination: tripDest,
          purpose: tripPurpose,
          startDate: tripStart,
          endDate: tripEnd,
          budget: tripBudget,
          projectId: tripProject || null
        })
      });
      setTripEmployee(''); setTripDest(''); setTripPurpose(''); setTripStart(''); setTripEnd(''); setTripBudget(''); setTripProject('');
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const updateTripStatus = async (id: number, status: string) => {
    if (!['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(currentUser?.role)) return;
    try {
      await fetch('/api/trips', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': pass || '', 'x-auth-password': pass || '', 'x-auth-login': localStorage.getItem('ae_auth_login') || '' },
        body: JSON.stringify({ id, status })
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrip) return;
    try {
      await fetch('/api/trips', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': pass || '', 'x-auth-password': pass || '', 'x-auth-login': localStorage.getItem('ae_auth_login') || '' },
        body: JSON.stringify({
          id: editingTrip.id,
          employeeId: editingTrip.employeeId,
          destination: editingTrip.destination,
          purpose: editingTrip.purpose,
          startDate: editingTrip.startDate,
          endDate: editingTrip.endDate,
          budget: editingTrip.budget,
          projectId: editingTrip.projectId || null
        })
      });
      setEditingTrip(null);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTrip = async (id: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить командировку?')) return;
    try {
      await fetch('/api/trips?id=' + id, {
        method: 'DELETE',
        headers: { 'x-admin-password': pass || '', 'x-auth-password': pass || '', 'x-auth-login': localStorage.getItem('ae_auth_login') || '' }
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
      <div className="card">
        <h2 className="card-title">✈️ Командировки</h2>
        
        <form onSubmit={handleTripSubmit} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px', padding: '15px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
          <select className="form-select" value={tripEmployee} onChange={e => setTripEmployee(e.target.value)} required style={{ flex: '1 1 150px' }}>
            <option value="">-- Сотрудник --</option>
            {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <input className="form-input" placeholder="Пункт назначения / Объект" value={tripDest} onChange={e => setTripDest(e.target.value)} required style={{ flex: '1 1 200px' }} />
          <input className="form-input" placeholder="Цель поездки" value={tripPurpose} onChange={e => setTripPurpose(e.target.value)} required style={{ flex: '1 1 200px' }} />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <DatePicker selected={tripStart ? new Date(tripStart) : null} onChange={(date: Date | null) => setTripStart(date ? date.toISOString().split('T')[0] : '')} dateFormat="dd/MM/yyyy" locale={ru} className="form-input" placeholderText="ДД/ММ/ГГГГ" required wrapperClassName="date-picker-wrapper" />
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>по</span>
            <DatePicker selected={tripEnd ? new Date(tripEnd) : null} onChange={(date: Date | null) => setTripEnd(date ? date.toISOString().split('T')[0] : '')} dateFormat="dd/MM/yyyy" locale={ru} className="form-input" placeholderText="ДД/ММ/ГГГГ" required wrapperClassName="date-picker-wrapper" />
          </div>

          <input className="form-input" type="number" placeholder="Бюджет (KZT)" value={tripBudget} onChange={e => setTripBudget(e.target.value)} required style={{ flex: '0 1 150px' }} />
          <select className="form-select" value={tripProject} onChange={e => setTripProject(e.target.value)} style={{ flex: '1 1 150px' }}>
            <option value="">-- Проект (опционально) --</option>
            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <button className="btn-submit" type="submit" style={{ flex: '0 1 150px' }}>Отправить</button>
        </form>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Сотрудник</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Назначение</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Сроки</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Проект</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Бюджет</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Статус</th>
                {['ADMIN', 'MANAGER'].includes(currentUser?.role) && <th style={{ padding: '10px', textAlign: 'left' }}>Действия</th>}
              </tr>
            </thead>
            <tbody>
              {trips.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{t.employee?.name}</td>
                  <td style={{ padding: '10px' }}>{t.destination}</td>
                  <td style={{ padding: '10px' }}>{formatDate(t.startDate)} - {formatDate(t.endDate)}</td>
                  <td style={{ padding: '10px' }}>{t.project?.name || '-'}</td>
                  <td style={{ padding: '10px' }}>{t.budget.toLocaleString()} ₸</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ 
                      padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold',
                      background: t.status === 'PENDING' ? 'rgba(245, 158, 11, 0.2)' : t.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.2)' : t.status === 'COMPLETED' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: t.status === 'PENDING' ? '#f59e0b' : t.status === 'APPROVED' ? '#10b981' : t.status === 'COMPLETED' ? '#3b82f6' : '#ef4444'
                     }}>
                      {t.status === 'PENDING' ? 'НА РАССМОТРЕНИИ' : t.status === 'APPROVED' ? 'ОДОБРЕНО' : t.status === 'COMPLETED' ? 'ЗАВЕРШЕНО' : 'ОТКЛОНЕНО'}
                    </span>
                  </td>
                  {['ADMIN', 'MANAGER'].includes(currentUser?.role) && (
                    <td style={{ padding: '10px', display: 'flex', gap: '5px' }}>
                      {t.status === 'PENDING' && (
                        <>
                          <button onClick={() => updateTripStatus(t.id, 'APPROVED')} className="inline-btn" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>✅</button>
                          <button onClick={() => updateTripStatus(t.id, 'REJECTED')} className="inline-btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>❌</button>
                        </>
                      )}
                      {t.status === 'APPROVED' && (
                        <button onClick={() => updateTripStatus(t.id, 'COMPLETED')} className="inline-btn" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>Завершить</button>
                      )}
                      {currentUser?.role === 'ADMIN' && (
                        <>
                          <button onClick={() => setEditingTrip(t)} className="inline-btn" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>✏️</button>
                          <button onClick={() => handleDeleteTrip(t.id)} className="inline-btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>🗑️</button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {trips.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Командировок нет.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingTrip && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="form-card" style={{ width: '400px', background: '#151b26' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Редактировать командировку</h3>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <select className="form-select" value={editingTrip.employeeId} onChange={e => setEditingTrip({...editingTrip, employeeId: e.target.value})} required>
                {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <input className="form-input" value={editingTrip.destination} onChange={e => setEditingTrip({...editingTrip, destination: e.target.value})} required />
              <input className="form-input" value={editingTrip.purpose} onChange={e => setEditingTrip({...editingTrip, purpose: e.target.value})} required />
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <DatePicker selected={editingTrip.startDate ? new Date(editingTrip.startDate) : null} onChange={(date: Date | null) => setEditingTrip({...editingTrip, startDate: date ? date.toISOString().split('T')[0] : ''})} dateFormat="dd/MM/yyyy" locale={ru} className="form-input" required wrapperClassName="date-picker-wrapper" />
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>по</span>
                <DatePicker selected={editingTrip.endDate ? new Date(editingTrip.endDate) : null} onChange={(date: Date | null) => setEditingTrip({...editingTrip, endDate: date ? date.toISOString().split('T')[0] : ''})} dateFormat="dd/MM/yyyy" locale={ru} className="form-input" required wrapperClassName="date-picker-wrapper" />
              </div>

              <input className="form-input" type="number" value={editingTrip.budget} onChange={e => setEditingTrip({...editingTrip, budget: e.target.value})} required />
              <select className="form-select" value={editingTrip.projectId || ''} onChange={e => setEditingTrip({...editingTrip, projectId: e.target.value})}>
                <option value="">-- Проект (опционально) --</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="inline-btn" onClick={() => setEditingTrip(null)}>Отмена</button>
                <button type="submit" className="btn-submit">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
