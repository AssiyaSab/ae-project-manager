'use client';

import React, { useState, useEffect } from 'react';

export default function ToolsTab({ currentUser, projects, users }: any) {
  const [tools, setTools] = useState<any[]>([]);
  
  // Forms
  const [toolName, setToolName] = useState('');
  const [toolSerial, setToolSerial] = useState('');
  const [toolCategory, setToolCategory] = useState('Электроинструмент');

  // Issue Form
  const [issueToolId, setIssueToolId] = useState<number | null>(null);
  const [issueEmployeeId, setIssueEmployeeId] = useState('');
  const [issueProjectId, setIssueProjectId] = useState('');
  const [issueDate, setIssueDate] = useState('');

  // Return Form
  const [returnLogId, setReturnLogId] = useState<number | null>(null);
  const [returnCondition, setReturnCondition] = useState('');
  const [returnStatus, setReturnStatus] = useState('AVAILABLE'); // AVAILABLE, REPAIR, WRITTEN_OFF

  const pass = typeof window !== 'undefined' ? localStorage.getItem('ae_admin_password') : '';

  const fetchTools = async () => {
    if (!pass) return;
    try {
      const headers = { 'x-auth-password': pass };
      const res = await fetch('/api/tools', { headers });
      const data = await res.json();
      if (Array.isArray(data)) setTools(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTools();
  }, [pass]);

  const handleToolSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': pass || '', 'x-auth-password': pass || '', 'x-auth-login': localStorage.getItem('ae_auth_login') || '' },
        body: JSON.stringify({ name: toolName, serialNumber: toolSerial, category: toolCategory })
      });
      setToolName(''); setToolSerial('');
      fetchTools();
    } catch (e) {
      console.error(e);
    }
  };

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueToolId) return;
    try {
      await fetch('/api/tools/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': pass || '', 'x-auth-password': pass || '', 'x-auth-login': localStorage.getItem('ae_auth_login') || '' },
        body: JSON.stringify({
          toolId: issueToolId,
          employeeId: issueEmployeeId,
          projectId: issueProjectId || null,
          plannedReturnDate: issueDate || null
        })
      });
      setIssueToolId(null); setIssueEmployeeId(''); setIssueProjectId(''); setIssueDate('');
      fetchTools();
    } catch (e) {
      console.error(e);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnLogId) return;
    const log = tools.flatMap(t => t.logs).find(l => l.id === returnLogId);
    if (!log) return;
    try {
      await fetch('/api/tools/logs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': pass || '', 'x-auth-password': pass || '', 'x-auth-login': localStorage.getItem('ae_auth_login') || '' },
        body: JSON.stringify({
          logId: returnLogId,
          toolId: log.toolId,
          condition: returnCondition,
          newStatus: returnStatus
        })
      });
      setReturnLogId(null); setReturnCondition(''); setReturnStatus('AVAILABLE');
      fetchTools();
    } catch (e) {
      console.error(e);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    // Dynamic import for xlsx to keep bundle light if possible, but static import is fine for React
    const XLSX = await import('xlsx');
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];
        
        // Skip header row
        const parsedTools = data.slice(1).map(row => ({
          name: row[0],
          category: row[1] || 'Общее',
          serialNumber: row[2] ? String(row[2]) : undefined,
        })).filter(t => t.name); // only if name exists
        
        if (parsedTools.length === 0) {
          alert("Не найдено валидных данных. Убедитесь, что колонки: Наименование, Категория, Серийный номер.");
          return;
        }

        const res = await fetch('/api/tools/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-password': pass || '', 'x-auth-password': pass || '', 'x-auth-login': localStorage.getItem('ae_auth_login') || '' },
          body: JSON.stringify({ tools: parsedTools })
        });
        
        if (res.ok) {
          alert(`Успешно импортировано ${parsedTools.length} инструментов!`);
          fetchTools();
        } else {
          alert("Ошибка при импорте.");
        }
      } catch (err) {
        console.error(err);
        alert("Ошибка при чтении файла");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // reset
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
      
      {/* ADD TOOL */}
      {currentUser?.role === 'ADMIN' && (
        <div className="card">
          <h2 className="card-title">🔧 Добавить новый инструмент на склад</h2>
          <form onSubmit={handleToolSubmit} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input className="form-input" placeholder="Наименование (напр. Перфоратор Makita)" value={toolName} onChange={e => setToolName(e.target.value)} required style={{ flex: '2 1 200px' }} />
            <input className="form-input" placeholder="Серийный/Инв. номер" value={toolSerial} onChange={e => setToolSerial(e.target.value)} style={{ flex: '1 1 150px' }} />
            <select className="form-select" value={toolCategory} onChange={e => setToolCategory(e.target.value)} required style={{ flex: '1 1 150px' }}>
              <option value="Электроинструмент">Электроинструмент</option>
              <option value="Измерительные приборы">Измерительные приборы</option>
              <option value="Ручной инструмент">Ручной инструмент</option>
              <option value="Расходники">Расходники</option>
            </select>
            <button className="btn-submit" type="submit" style={{ flex: '0 1 150px' }}>+ Добавить</button>
            <label className="inline-btn" style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.08)', padding: '6px 12px', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', borderColor: 'rgba(255,255,255,0.2)', flex: '0 1 150px', justifyContent: 'center' }}>
              📥 Импорт Excel
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleImportExcel} style={{ display: 'none' }} />
            </label>
          </form>
        </div>
      )}

      {/* TOOLS LIST */}
      <div className="card">
        <h2 className="card-title">📦 Учет инструмента</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Наименование</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Категория</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Номер</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Статус</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Ответственный</th>
                {currentUser?.role === 'ADMIN' && <th style={{ padding: '10px', textAlign: 'left' }}>Управление</th>}
              </tr>
            </thead>
            <tbody>
              {tools.map(t => {
                const activeLog = t.status === 'IN_USE' ? t.logs[0] : null; // First log is most recent
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px', fontWeight: 600 }}>{t.name}</td>
                    <td style={{ padding: '10px', color: 'var(--text-muted)' }}>{t.category}</td>
                    <td style={{ padding: '10px' }}>{t.serialNumber || '-'}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ 
                        padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold',
                        background: t.status === 'AVAILABLE' ? 'rgba(16, 185, 129, 0.2)' : t.status === 'IN_USE' ? 'rgba(59, 130, 246, 0.2)' : t.status === 'REPAIR' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: t.status === 'AVAILABLE' ? '#10b981' : t.status === 'IN_USE' ? '#3b82f6' : t.status === 'REPAIR' ? '#f59e0b' : '#ef4444'
                       }}>
                        {t.status === 'AVAILABLE' ? 'НА СКЛАДЕ' : t.status === 'IN_USE' ? 'ВЫДАН' : t.status === 'REPAIR' ? 'В РЕМОНТЕ' : 'СПИСАН'}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      {t.holder ? <span>👤 {t.holder.name}</span> : '-'}
                    </td>
                    {currentUser?.role === 'ADMIN' && (
                      <td style={{ padding: '10px' }}>
                        {t.status === 'AVAILABLE' && (
                          <button onClick={() => setIssueToolId(t.id)} className="inline-btn" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>Выдать</button>
                        )}
                        {t.status === 'IN_USE' && activeLog && (
                          <button onClick={() => setReturnLogId(activeLog.id)} className="inline-btn" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>Оформить возврат</button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
              {tools.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>База инструментов пуста.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ISSUE MODAL */}
      {issueToolId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="form-card" style={{ width: '400px', background: '#151b26' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Выдача инструмента</h3>
            <form onSubmit={handleIssueSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label className="form-label">Сотрудник</label>
                <select className="form-select" value={issueEmployeeId} onChange={e => setIssueEmployeeId(e.target.value)} required>
                  <option value="">-- Выберите --</option>
                  {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Проект (объект)</label>
                <select className="form-select" value={issueProjectId} onChange={e => setIssueProjectId(e.target.value)}>
                  <option value="">-- На какой объект (опционально) --</option>
                  {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Дата планового возврата</label>
                <input type="date" className="form-input" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="inline-btn" onClick={() => setIssueToolId(null)}>Отмена</button>
                <button type="submit" className="btn-submit">Выдать</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RETURN MODAL */}
      {returnLogId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="form-card" style={{ width: '400px', background: '#151b26' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Возврат инструмента</h3>
            <form onSubmit={handleReturnSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label className="form-label">Состояние инструмента</label>
                <input type="text" className="form-input" placeholder="Напр: Исправен, царапины..." value={returnCondition} onChange={e => setReturnCondition(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Новый статус</label>
                <select className="form-select" value={returnStatus} onChange={e => setReturnStatus(e.target.value)}>
                  <option value="AVAILABLE">Вернуть на склад (Свободен)</option>
                  <option value="REPAIR">Отправить в ремонт</option>
                  <option value="WRITTEN_OFF">Списать (Сломан окончательно)</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="inline-btn" onClick={() => setReturnLogId(null)}>Отмена</button>
                <button type="submit" className="btn-submit">Оформить возврат</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
