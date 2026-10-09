import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ru } from 'date-fns/locale';
import { formatDate } from '@/lib/formatters';
import { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import PrintPurchaseRequest from './PrintPurchaseRequest';

export default function PurchasesTab({ currentUser, projects, users }: any) {
  const [purchases, setPurchases] = useState<any[]>([]);

  const [purchaseTitle, setPurchaseTitle] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [purchaseProject, setPurchaseProject] = useState('');
  const [purchaseFileUrl, setPurchaseFileUrl] = useState('');

  const [editingPurchase, setEditingPurchase] = useState<any>(null);

  const purchasePrintRef = useRef(null);
  const [activePurchaseForPrint, setActivePurchaseForPrint] = useState<any>(null);
  const handlePrintPurchase = useReactToPrint({
    contentRef: purchasePrintRef,
    documentTitle: 'Zayavka_Na_Rashody'
  });

  const generatePurchasePDF = (purchase: any) => {
    setActivePurchaseForPrint(purchase);
    setTimeout(() => {
      handlePrintPurchase();
    }, 100);
  };

  const pass = typeof window !== 'undefined' ? localStorage.getItem('ae_admin_password') : '';

  const fetchData = async () => {
    if (!pass && currentUser?.role !== 'ENGINEER' && currentUser?.role !== 'ASSEMBLER') return;
    try {
      const headers = { 
        'x-auth-password': pass || '',
        'x-auth-login': localStorage.getItem('ae_auth_login') || ''
      };
      
      const res = await fetch('/api/purchases', { headers });
      const pRes = await res.json();
      
      if (Array.isArray(pRes)) setPurchases(pRes);
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
          projectId: purchaseProject || null,
          fileUrl: purchaseFileUrl
        })
      });
      setPurchaseTitle(''); setPurchaseAmount(''); setPurchaseProject(''); setPurchaseFileUrl('');
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const updatePurchaseStatus = async (id: number, status: string) => {
    if (!['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(currentUser?.role)) return;
    try {
      await fetch('/api/purchases', {
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
    if (!editingPurchase) return;
    try {
      await fetch('/api/purchases', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': pass || '', 'x-auth-password': pass || '', 'x-auth-login': localStorage.getItem('ae_auth_login') || '' },
        body: JSON.stringify({ 
          id: editingPurchase.id, 
          title: editingPurchase.title,
          amount: editingPurchase.amount,
          projectId: editingPurchase.projectId || null,
          fileUrl: editingPurchase.fileUrl
        })
      });
      setEditingPurchase(null);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeletePurchase = async (id: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить заявку?')) return;
    try {
      await fetch(`/api/purchases?id=${id}`, {
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
      
      {/* PURCHASES */}
      <div className="card">
        <h2 className="card-title">🛒 Заявки на закупку (Подотчет)</h2>
        
        <form onSubmit={handlePurchaseSubmit} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px', padding: '15px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
          <input className="form-input" placeholder="Назначение платежа / Список" value={purchaseTitle} onChange={e => setPurchaseTitle(e.target.value)} required style={{ flex: '2 1 200px' }} />
          <input className="form-input" type="number" placeholder="Сумма (KZT)" value={purchaseAmount} onChange={e => setPurchaseAmount(e.target.value)} required style={{ flex: '1 1 150px' }} />
          <select className="form-select" value={purchaseProject} onChange={e => setPurchaseProject(e.target.value)} style={{ flex: '1 1 150px' }}>
            <option value="">-- Проект (опционально) --</option>
            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input className="form-input" placeholder="Ссылка на скан/счет (опц.)" value={purchaseFileUrl} onChange={e => setPurchaseFileUrl(e.target.value)} style={{ flex: '1 1 150px' }} />
          <button className="btn-submit" type="submit" style={{ flex: '0 1 150px' }}>Отправить</button>
        </form>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Дата</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Заявитель</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Назначение</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Сумма</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Статус</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Док</th>
                {['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(currentUser?.role) && <th style={{ padding: '10px', textAlign: 'left' }}>Действия</th>}
              </tr>
            </thead>
            <tbody>
              {purchases.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px' }}>{formatDate(p.createdAt)}</td>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{p.requester?.name}</td>
                  <td style={{ padding: '10px' }}>
                    {p.title}
                    {p.project && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Проект: {p.project.name}</div>}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>{p.amount.toLocaleString()} ₸</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ 
                      padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold',
                      background: p.status === 'PENDING' ? 'rgba(245, 158, 11, 0.2)' : p.status === 'APPROVED' ? 'rgba(59, 130, 246, 0.2)' : p.status === 'PAID' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: p.status === 'PENDING' ? '#f59e0b' : p.status === 'APPROVED' ? '#3b82f6' : p.status === 'PAID' ? '#10b981' : '#ef4444'
                     }}>
                      {p.status === 'PENDING' ? 'ОЖИДАЕТ' : p.status === 'APPROVED' ? 'ОДОБРЕНО' : p.status === 'PAID' ? 'ОПЛАЧЕНО' : 'ОТКЛОНЕНО'}
                    </span>
                  </td>
                  <td style={{ padding: '10px' }}>
                    {p.fileUrl ? <a href={p.fileUrl} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>Скан</a> : '-'}
                                    </td>
                  <td style={{ padding: '10px' }}>
                    <button onClick={() => generatePurchasePDF(p)} className="inline-btn" style={{ background: '#3b82f6', color: '#fff', fontSize: '0.8rem' }}>📄 PDF</button>
                  </td>
                  {['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(currentUser?.role) && (
                    <td style={{ padding: '10px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {p.status === 'PENDING' && ['ADMIN', 'MANAGER'].includes(currentUser?.role) && (
                        <>
                          <button onClick={() => updatePurchaseStatus(p.id, 'APPROVED')} className="inline-btn" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>✅</button>
                          <button onClick={() => updatePurchaseStatus(p.id, 'REJECTED')} className="inline-btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>❌</button>
                        </>
                      )}
                      {p.status === 'APPROVED' && ['ADMIN', 'ACCOUNTANT'].includes(currentUser?.role) && (
                        <button onClick={() => updatePurchaseStatus(p.id, 'PAID')} className="inline-btn" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>Оплатить</button>
                      )}
                      {currentUser?.role === 'ADMIN' && (
                        <>
                          <button onClick={() => setEditingPurchase(p)} className="inline-btn" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>✏️</button>
                          <button onClick={() => handleDeletePurchase(p.id)} className="inline-btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>🗑️</button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Заявок нет.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingPurchase && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="form-card" style={{ width: '400px', background: '#151b26' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Редактировать заявку</h3>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input className="form-input" value={editingPurchase.title} onChange={e => setEditingPurchase({...editingPurchase, title: e.target.value})} required />
              <input className="form-input" type="number" value={editingPurchase.amount} onChange={e => setEditingPurchase({...editingPurchase, amount: e.target.value})} required />
              <select className="form-select" value={editingPurchase.projectId || ''} onChange={e => setEditingPurchase({...editingPurchase, projectId: e.target.value})}>
                <option value="">-- Без проекта --</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input className="form-input" placeholder="Ссылка на скан" value={editingPurchase.fileUrl || ''} onChange={e => setEditingPurchase({...editingPurchase, fileUrl: e.target.value})} />
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="inline-btn" onClick={() => setEditingPurchase(null)}>Отмена</button>
                <button type="submit" className="btn-submit">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ display: 'none' }}>
        <PrintPurchaseRequest ref={purchasePrintRef} purchase={activePurchaseForPrint} />
      </div>
    </div>
  );
}




