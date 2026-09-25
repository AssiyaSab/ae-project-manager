'use client';

import React, { useState, useEffect } from 'react';

export default function PurchasesTab({ currentUser, projects, users }: any) {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  
  // Forms
  const [purchaseTitle, setPurchaseTitle] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [purchaseProject, setPurchaseProject] = useState('');
  const [purchaseFileUrl, setPurchaseFileUrl] = useState('');
  
  const [tripEmployee, setTripEmployee] = useState('');
  const [tripDest, setTripDest] = useState('');
  const [tripPurpose, setTripPurpose] = useState('');
  const [tripStart, setTripStart] = useState('');
  const [tripEnd, setTripEnd] = useState('');
  const [tripBudget, setTripBudget] = useState('');
  const [tripProject, setTripProject] = useState('');

  const pass = typeof window !== 'undefined' ? localStorage.getItem('ae_admin_password') : '';

  const fetchData = async () => {
    if (!pass) return;
    try {
      const headers = { 'x-auth-password': pass };
      const [pRes, tRes] = await Promise.all([
        fetch('/api/purchases', { headers }).then(r => r.json()),
        fetch('/api/trips', { headers }).then(r => r.json())
      ]);
      if (Array.isArray(pRes)) setPurchases(pRes);
      if (Array.isArray(tRes)) setTrips(tRes);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [pass]);

  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-password': pass || '', 'x-auth-login': localStorage.getItem('ae_auth_login') || '' },
        body: JSON.stringify({
          title: purchaseTitle,
          amount: purchaseAmount,
          projectId: purchaseProject,
          fileUrl: purchaseFileUrl,
          requesterId: currentUser?.id
        })
      });
      setPurchaseTitle(''); setPurchaseAmount(''); setPurchaseProject(''); setPurchaseFileUrl('');
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

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

  const updatePurchaseStatus = async (id: number, status: string) => {
    if (!['ADMIN', 'MANAGER'].includes(currentUser?.role)) return;
    await fetch('/api/purchases', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': pass || '', 'x-auth-password': pass || '', 'x-auth-login': localStorage.getItem('ae_auth_login') || '' },
      body: JSON.stringify({ id, status })
    });
    fetchData();
  };

  const updateTripStatus = async (id: number, status: string) => {
    if (!['ADMIN', 'MANAGER'].includes(currentUser?.role)) return;
    await fetch('/api/trips', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': pass || '', 'x-auth-password': pass || '', 'x-auth-login': localStorage.getItem('ae_auth_login') || '' },
      body: JSON.stringify({ id, status })
    });
    fetchData();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
      
      {/* PURCHASES */}
      <div className="card">
        <h2 className="card-title">🛒 Заявки на закупку / Расходы</h2>
        {['ADMIN', 'MANAGER'].includes(currentUser?.role) && (
          <form onSubmit={handlePurchaseSubmit} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px', padding: '15px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
            <input className="form-input" placeholder="Наименование (ТМЦ, Услуга)" value={purchaseTitle} onChange={e => setPurchaseTitle(e.target.value)} required style={{ flex: '1 1 200px' }} />
            <input className="form-input" type="number" placeholder="Сумма (KZT)" value={purchaseAmount} onChange={e => setPurchaseAmount(e.target.value)} required style={{ flex: '0 1 150px' }} />
            <select className="form-select" value={purchaseProject} onChange={e => setPurchaseProject(e.target.value)} required style={{ flex: '1 1 200px' }}>
              <option value="">-- Выберите проект --</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input className="form-input" placeholder="Ссылка на чек (или отправьте фото в Telegram-бот)" value={purchaseFileUrl} onChange={e => setPurchaseFileUrl(e.target.value)} style={{ flex: '1 1 200px' }} />
            <button className="btn-submit" type="submit" style={{ flex: '0 1 150px' }}>+ Создать</button>
          </form>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Дата</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Закупка</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Сумма</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Проект</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Скан/Чек</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Статус</th>
                {['ADMIN', 'MANAGER'].includes(currentUser?.role) && <th style={{ padding: '10px', textAlign: 'left' }}>Действия</th>}
              </tr>
            </thead>
            <tbody>
              {purchases.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px' }}>{new Date(p.createdAt).toLocaleDateString('ru-RU')}</td>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{p.title}</td>
                  <td style={{ padding: '10px', color: '#10b981' }}>{p.amount.toLocaleString()} ₸</td>
                  <td style={{ padding: '10px' }}>{p.project?.name}</td>
                  <td style={{ padding: '10px' }}>
                    {p.fileUrl ? <a href={p.fileUrl} target="_blank" style={{ color: '#3b82f6', textDecoration: 'underline' }}>Ссылка</a> : '-'}
                  </td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ 
                      padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold',
                      background: p.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.2)' : p.status === 'REJECTED' ? 'rgba(239, 68, 68, 0.2)' : p.status === 'PAID' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: p.status === 'APPROVED' ? '#10b981' : p.status === 'REJECTED' ? '#ef4444' : p.status === 'PAID' ? '#3b82f6' : '#f59e0b'
                     }}>
                      {p.status}
                    </span>
                  </td>
                  {['ADMIN', 'MANAGER'].includes(currentUser?.role) && (
                    <td style={{ padding: '10px', display: 'flex', gap: '5px' }}>
                      {p.status === 'PENDING' && (
                        <>
                          <button onClick={() => updatePurchaseStatus(p.id, 'APPROVED')} className="inline-btn" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>✅</button>
                          <button onClick={() => updatePurchaseStatus(p.id, 'REJECTED')} className="inline-btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>❌</button>
                        </>
                      )}
                      {p.status === 'APPROVED' && (
                        <button onClick={() => updatePurchaseStatus(p.id, 'PAID')} className="inline-btn" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>Оплачено</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Заявок пока нет.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TRIPS */}
      <div className="card">
        <h2 className="card-title">✈️ Командировки</h2>
        {['ADMIN', 'MANAGER'].includes(currentUser?.role) && (
          <form onSubmit={handleTripSubmit} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px', padding: '15px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
            <select className="form-select" value={tripEmployee} onChange={e => setTripEmployee(e.target.value)} required style={{ flex: '1 1 150px' }}>
              <option value="">-- Сотрудник --</option>
              {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <input className="form-input" placeholder="Пункт назначения / Объект" value={tripDest} onChange={e => setTripDest(e.target.value)} required style={{ flex: '1 1 200px' }} />
            <input className="form-input" placeholder="Цель поездки" value={tripPurpose} onChange={e => setTripPurpose(e.target.value)} required style={{ flex: '1 1 200px' }} />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>С</span>
              <input className="form-input" type="date" value={tripStart} onChange={e => setTripStart(e.target.value)} required style={{ width: '125px' }} />
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>ПО</span>
              <input className="form-input" type="date" value={tripEnd} onChange={e => setTripEnd(e.target.value)} required style={{ width: '125px' }} />
            </div>

            <input className="form-input" type="number" placeholder="Бюджет (KZT)" value={tripBudget} onChange={e => setTripBudget(e.target.value)} required style={{ flex: '0 1 150px' }} />
            <select className="form-select" value={tripProject} onChange={e => setTripProject(e.target.value)} style={{ flex: '1 1 150px' }}>
              <option value="">-- Проект (опционально) --</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            
            <button className="btn-submit" type="submit" style={{ flex: '0 1 150px' }}>+ Оформить</button>
          </form>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Сотрудник</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Куда / Зачем</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Даты</th>
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
                  <td style={{ padding: '10px' }}>{t.destination} <br/><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.purpose}</span></td>
                  <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>{new Date(t.startDate).toLocaleDateString('ru-RU')} - {new Date(t.endDate).toLocaleDateString('ru-RU')}</td>
                  <td style={{ padding: '10px' }}>{t.project?.name || '-'}</td>
                  <td style={{ padding: '10px', color: '#10b981' }}>{t.budget.toLocaleString()} ₸</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ 
                      padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold',
                      background: t.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.2)' : t.status === 'REJECTED' ? 'rgba(239, 68, 68, 0.2)' : t.status === 'COMPLETED' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: t.status === 'APPROVED' ? '#10b981' : t.status === 'REJECTED' ? '#ef4444' : t.status === 'COMPLETED' ? '#3b82f6' : '#f59e0b'
                     }}>
                      {t.status}
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
                        <button onClick={() => updateTripStatus(t.id, 'COMPLETED')} className="inline-btn" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>Завершено</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {trips.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Командировок пока нет.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
