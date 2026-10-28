import React, { useState, useEffect, useRef } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ru } from 'date-fns/locale';
import { formatDate } from '@/lib/formatters';
import { useReactToPrint } from 'react-to-print';
import PrintPurchaseRequest from './PrintPurchaseRequest';

export default function PurchasesTab({ currentUser, projects, users }: any) {
  const [purchases, setPurchases] = useState<any[]>([]);

  // Creation State
  const [purchaseType, setPurchaseType] = useState<'INVOICE' | 'EXPENSE'>('INVOICE');
  const [purchaseTitle, setPurchaseTitle] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [purchaseProject, setPurchaseProject] = useState('');
  const [purchaseFileUrl, setPurchaseFileUrl] = useState('');

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Supply Processing Modal State
  const [supplyModalPurchase, setSupplyModalPurchase] = useState<any>(null);
  const [supplySupplierName, setSupplySupplierName] = useState('');
  const [supplyInvoiceNumber, setSupplyInvoiceNumber] = useState('');
  const [supplyInvoiceDate, setSupplyInvoiceDate] = useState('');
  const [supplyAmount, setSupplyAmount] = useState('');
  const [supplyDeliveryDate, setSupplyDeliveryDate] = useState('');
  const [supplyComment, setSupplyComment] = useState('');
  const [supplyInvoiceFileUrl, setSupplyInvoiceFileUrl] = useState('');

  // Edit State
  const [editingPurchase, setEditingPurchase] = useState<any>(null);

  // Print Ref
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
    if (!purchaseProject) {
      alert('Пожалуйста, выберите проект');
      return;
    }
    try {
      await fetch('/api/purchases', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'x-auth-password': pass || '', 
          'x-auth-login': localStorage.getItem('ae_auth_login') || '' 
        },
        body: JSON.stringify({
          type: purchaseType,
          title: purchaseTitle,
          amount: purchaseAmount ? Number(purchaseAmount) : 0,
          projectId: purchaseProject,
          fileUrl: purchaseFileUrl
        })
      });
      setPurchaseTitle(''); 
      setPurchaseAmount(''); 
      setPurchaseProject(''); 
      setPurchaseFileUrl('');
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const updatePurchaseStatus = async (id: number, status: string, extraData: any = {}) => {
    try {
      await fetch('/api/purchases', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json', 
          'x-admin-password': pass || '', 
          'x-auth-password': pass || '', 
          'x-auth-login': localStorage.getItem('ae_auth_login') || '' 
        },
        body: JSON.stringify({ id, status, ...extraData })
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Open Supply Modal
  const openSupplyModal = (p: any) => {
    setSupplyModalPurchase(p);
    setSupplySupplierName(p.supplierName || '');
    setSupplyInvoiceNumber(p.invoiceNumber || '');
    setSupplyInvoiceDate(p.invoiceDate ? p.invoiceDate.split('T')[0] : '');
    setSupplyAmount(p.amount ? String(p.amount) : '');
    setSupplyDeliveryDate(p.plannedDeliveryDate ? p.plannedDeliveryDate.split('T')[0] : '');
    setSupplyComment(p.supplyComment || '');
    setSupplyInvoiceFileUrl(p.invoiceFileUrl || '');
  };

  const handleSupplyModalSubmit = async (targetStatus: string) => {
    if (!supplyModalPurchase) return;
    try {
      await updatePurchaseStatus(supplyModalPurchase.id, targetStatus, {
        supplierName: supplySupplierName,
        invoiceNumber: supplyInvoiceNumber,
        invoiceDate: supplyInvoiceDate || null,
        amount: Number(supplyAmount) || 0,
        plannedDeliveryDate: supplyDeliveryDate || null,
        supplyComment: supplyComment,
        invoiceFileUrl: supplyInvoiceFileUrl
      });
      setSupplyModalPurchase(null);
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
        headers: { 
          'Content-Type': 'application/json', 
          'x-admin-password': pass || '', 
          'x-auth-password': pass || '', 
          'x-auth-login': localStorage.getItem('ae_auth_login') || '' 
        },
        body: JSON.stringify({ 
          id: editingPurchase.id, 
          title: editingPurchase.title,
          amount: editingPurchase.amount,
          projectId: editingPurchase.projectId || null,
          fileUrl: editingPurchase.fileUrl,
          supplierName: editingPurchase.supplierName,
          invoiceNumber: editingPurchase.invoiceNumber
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
        headers: { 
          'x-admin-password': pass || '', 
          'x-auth-password': pass || '', 
          'x-auth-login': localStorage.getItem('ae_auth_login') || '' 
        }
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Helper status badge renderer
  const renderStatusBadge = (status: string) => {
    let text = status;
    let bg = 'rgba(255, 255, 255, 0.1)';
    let color = '#fff';

    switch (status) {
      case 'PENDING_APPROVAL':
      case 'PENDING':
        text = '1. ЖДЕТ ГИПа';
        bg = 'rgba(245, 158, 11, 0.2)';
        color = '#f59e0b';
        break;
      case 'IN_PROCUREMENT':
        text = '2. В СНАБЖЕНИИ';
        bg = 'rgba(59, 130, 246, 0.2)';
        color = '#3b82f6';
        break;
      case 'PENDING_PAYMENT_APPROVAL':
        text = '3. СЧЕТ ГОТОВ (ЖДЕТ ГИПа)';
        bg = 'rgba(168, 85, 247, 0.2)';
        color = '#c084fc';
        break;
      case 'APPROVED_FOR_PAYMENT':
      case 'APPROVED':
        text = '4. НА ОПЛАТЕ';
        bg = 'rgba(249, 115, 22, 0.2)';
        color = '#fb923c';
        break;
      case 'PAID_AND_ORDERED':
      case 'PAID':
        text = '5. ОПЛАЧЕНО / В ПУТИ';
        bg = 'rgba(16, 185, 129, 0.2)';
        color = '#10b981';
        break;
      case 'DELIVERED':
        text = '6. ДОСТАВЛЕНО / НА СКЛАДЕ';
        bg = 'rgba(20, 184, 166, 0.2)';
        color = '#2dd4bf';
        break;
      case 'PENDING_EXPENSE':
        text = 'ПОДОТЧЕТ (ЖДЕТ ГИПа)';
        bg = 'rgba(245, 158, 11, 0.2)';
        color = '#f59e0b';
        break;
      case 'APPROVED_EXPENSE':
        text = 'ПОДОТЧЕТ (К ВЫПЛАТЕ)';
        bg = 'rgba(249, 115, 22, 0.2)';
        color = '#fb923c';
        break;
      case 'PAID_EXPENSE':
        text = 'ПОДОТЧЕТ ВЫПЛАЧЕН';
        bg = 'rgba(16, 185, 129, 0.2)';
        color = '#10b981';
        break;
      case 'REJECTED':
        text = 'ОТКЛОНЕНО';
        bg = 'rgba(239, 68, 68, 0.2)';
        color = '#ef4444';
        break;
    }

    return (
      <span style={{ 
        padding: '5px 10px', 
        borderRadius: '6px', 
        fontSize: '0.75rem', 
        fontWeight: 'bold', 
        background: bg, 
        color, 
        display: 'inline-block',
        whiteSpace: 'nowrap'
      }}>
        {text}
      </span>
    );
  };

  // Filtered purchases
  const filteredPurchases = purchases.filter(p => {
    if (typeFilter !== 'ALL') {
      if (typeFilter === 'INVOICE' && p.type === 'EXPENSE') return false;
      if (typeFilter === 'EXPENSE' && p.type !== 'EXPENSE') return false;
    }

    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'PENDING_GIP') return ['PENDING_APPROVAL', 'PENDING', 'PENDING_EXPENSE'].includes(p.status);
    if (statusFilter === 'SUPPLY') return ['IN_PROCUREMENT', 'APPROVED'].includes(p.status);
    if (statusFilter === 'GIP_INVOICE') return p.status === 'PENDING_PAYMENT_APPROVAL';
    if (statusFilter === 'ACCOUNTANT') return ['APPROVED_FOR_PAYMENT', 'APPROVED_EXPENSE'].includes(p.status);
    if (statusFilter === 'IN_TRANSIT') return ['PAID_AND_ORDERED', 'PAID'].includes(p.status);
    if (statusFilter === 'DELIVERED') return p.status === 'DELIVERED';
    if (statusFilter === 'REJECTED') return p.status === 'REJECTED';
    return true;
  });

  const role = currentUser?.role;
  const isGipOrManager = ['ADMIN', 'MANAGER'].includes(role);
  const isSupply = ['SUPPLY', 'ADMIN'].includes(role);
  const isAccountant = ['ACCOUNTANT', 'ADMIN'].includes(role);
  const isWarehouse = ['WAREHOUSE', 'ADMIN'].includes(role);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* HEADER & NEW REQUEST FORM */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h2 className="card-title" style={{ margin: 0 }}>🛒 Снабжение и Закупки ТМЦ</h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              ТОО «АзияЭнергоАвтоматика»: Заявки на закупку оборудования, комплектующих и подотчетные расходы
            </div>
          </div>
          
          {/* TYPE TOGGLE BUTTONS */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '4px', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setPurchaseType('INVOICE')}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
                background: purchaseType === 'INVOICE' ? '#3b82f6' : 'transparent',
                color: purchaseType === 'INVOICE' ? '#fff' : 'var(--text-muted)'
              }}
            >
              🏢 Безналичный счет на ТОО (Снабжение)
            </button>
            <button
              type="button"
              onClick={() => setPurchaseType('EXPENSE')}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
                background: purchaseType === 'EXPENSE' ? '#f59e0b' : 'transparent',
                color: purchaseType === 'EXPENSE' ? '#fff' : 'var(--text-muted)'
              }}
            >
              🧾 Срочный подотчет (Чек/наличные)
            </button>
          </div>
        </div>

        {/* CREATE FORM */}
        <form onSubmit={handlePurchaseSubmit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ flex: '2 1 300px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
              {purchaseType === 'INVOICE' ? 'Потребность / Спецификация оборудования' : 'Назначение платежа / Купленные расходники'} *
            </label>
            <input 
              className="form-input" 
              placeholder={purchaseType === 'INVOICE' ? 'Например: Реле Finder 24V - 10 шт, автоматы IEK 16A - 4 шт для шкафа ШУ-1' : 'Например: Крепеж, сверла 6мм на объект'} 
              value={purchaseTitle} 
              onChange={e => setPurchaseTitle(e.target.value)} 
              required 
            />
          </div>

          <div style={{ flex: '1 1 180px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
              Проект ТОО *
            </label>
            <select className="form-select" value={purchaseProject} onChange={e => setPurchaseProject(e.target.value)} required>
              <option value="">-- Выберите проект --</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div style={{ flex: '1 1 150px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
              {purchaseType === 'INVOICE' ? 'Ориент. сумма ₸ (опц.)' : 'Сумма по чеку ₸ *'}
            </label>
            <input 
              className="form-input" 
              type="number" 
              placeholder={purchaseType === 'INVOICE' ? 'Определит снабженец' : 'Сумма (KZT)'} 
              value={purchaseAmount} 
              onChange={e => setPurchaseAmount(e.target.value)} 
              required={purchaseType === 'EXPENSE'} 
            />
          </div>

          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
              {purchaseType === 'INVOICE' ? 'Ссылка на спецификацию/каталог (опц.)' : 'Ссылка на скан/чек (опц.)'}
            </label>
            <input className="form-input" placeholder="Google Drive / ссылка" value={purchaseFileUrl} onChange={e => setPurchaseFileUrl(e.target.value)} />
          </div>

          <div style={{ flex: '0 1 160px', display: 'flex', alignItems: 'flex-end' }}>
            <button 
              className="btn-submit" 
              type="submit" 
              style={{ width: '100%', height: '42px', background: purchaseType === 'INVOICE' ? '#3b82f6' : '#f59e0b', color: '#fff' }}
            >
              {purchaseType === 'INVOICE' ? '🚀 В снабжение' : '💰 На подотчет'}
            </button>
          </div>
        </form>

        {/* FILTERS */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '25px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Фильтры:</span>
          
          <button 
            onClick={() => setStatusFilter('ALL')} 
            className="inline-btn" 
            style={{ background: statusFilter === 'ALL' ? '#3b82f6' : 'rgba(255,255,255,0.05)', color: '#fff' }}
          >
            Все ({purchases.length})
          </button>
          
          <button 
            onClick={() => setStatusFilter('PENDING_GIP')} 
            className="inline-btn" 
            style={{ background: statusFilter === 'PENDING_GIP' ? '#f59e0b' : 'rgba(255,255,255,0.05)', color: '#fff' }}
          >
            ⏳ Ждут ГИПа
          </button>
          
          <button 
            onClick={() => setStatusFilter('SUPPLY')} 
            className="inline-btn" 
            style={{ background: statusFilter === 'SUPPLY' ? '#3b82f6' : 'rgba(255,255,255,0.05)', color: '#fff' }}
          >
            📦 В снабжении
          </button>

          <button 
            onClick={() => setStatusFilter('GIP_INVOICE')} 
            className="inline-btn" 
            style={{ background: statusFilter === 'GIP_INVOICE' ? '#a855f7' : 'rgba(255,255,255,0.05)', color: '#fff' }}
          >
            📑 Утверждение счета
          </button>

          <button 
            onClick={() => setStatusFilter('ACCOUNTANT')} 
            className="inline-btn" 
            style={{ background: statusFilter === 'ACCOUNTANT' ? '#f97316' : 'rgba(255,255,255,0.05)', color: '#fff' }}
          >
            💳 На оплате
          </button>

          <button 
            onClick={() => setStatusFilter('IN_TRANSIT')} 
            className="inline-btn" 
            style={{ background: statusFilter === 'IN_TRANSIT' ? '#10b981' : 'rgba(255,255,255,0.05)', color: '#fff' }}
          >
            🚚 Оплачено / В пути
          </button>

          <button 
            onClick={() => setStatusFilter('DELIVERED')} 
            className="inline-btn" 
            style={{ background: statusFilter === 'DELIVERED' ? '#14b8a6' : 'rgba(255,255,255,0.05)', color: '#fff' }}
          >
            ✅ Доставлено
          </button>

          {/* Type filter dropdown */}
          <select 
            className="form-select" 
            style={{ width: '160px', marginLeft: 'auto', padding: '6px 10px', fontSize: '0.8rem' }}
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option value="ALL">Все типы</option>
            <option value="INVOICE">🏢 Только Безнал</option>
            <option value="EXPENSE">🧾 Только Подотчет</option>
          </select>
        </div>

        {/* PURCHASES TABLE */}
        <div style={{ overflowX: 'auto', marginTop: '20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 10px', textAlign: 'left' }}>Дата / Тип</th>
                <th style={{ padding: '12px 10px', textAlign: 'left' }}>Заявитель</th>
                <th style={{ padding: '12px 10px', textAlign: 'left' }}>Потребность / Проект / Поставщик</th>
                <th style={{ padding: '12px 10px', textAlign: 'right' }}>Сумма</th>
                <th style={{ padding: '12px 10px', textAlign: 'left' }}>Статус заявки</th>
                <th style={{ padding: '12px 10px', textAlign: 'center' }}>Счет / Док</th>
                <th style={{ padding: '12px 10px', textAlign: 'left' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  
                  {/* DATE & TYPE */}
                  <td style={{ padding: '12px 10px', verticalAlign: 'top', width: '110px' }}>
                    <div style={{ fontWeight: 500 }}>{formatDate(p.createdAt)}</div>
                    <span style={{ 
                      fontSize: '0.7rem', 
                      fontWeight: 600, 
                      color: p.type === 'EXPENSE' ? '#f59e0b' : '#3b82f6',
                      display: 'inline-block',
                      marginTop: '3px'
                    }}>
                      {p.type === 'EXPENSE' ? '🧾 Подотчет' : '🏢 Безнал'}
                    </span>
                  </td>

                  {/* REQUESTER */}
                  <td style={{ padding: '12px 10px', verticalAlign: 'top', fontWeight: 600, width: '140px' }}>
                    <div>{p.requester?.name || 'Сотрудник'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.requester?.title || ''}</div>
                  </td>

                  {/* TITLE, PROJECT & SUPPLIER DETAILS */}
                  <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{p.title}</div>
                    
                    {p.project && (
                      <div style={{ fontSize: '0.8rem', color: '#38bdf8', marginTop: '2px' }}>
                        Проект: {p.project.name}
                      </div>
                    )}

                    {/* SUPPLIER CARD INFO IF ENTERED BY SUPPLY */}
                    {p.supplierName && (
                      <div style={{ 
                        marginTop: '8px', 
                        padding: '8px 12px', 
                        background: 'rgba(59, 130, 246, 0.08)', 
                        border: '1px solid rgba(59, 130, 246, 0.2)', 
                        borderRadius: '6px', 
                        fontSize: '0.8rem' 
                      }}>
                        <div style={{ fontWeight: 600, color: '#93c5fd' }}>
                          🏢 Поставщик: {p.supplierName}
                        </div>
                        <div style={{ display: 'flex', gap: '15px', marginTop: '3px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                          {p.invoiceNumber && <span>Счет: №{p.invoiceNumber} {p.invoiceDate ? `от ${formatDate(p.invoiceDate)}` : ''}</span>}
                          {p.plannedDeliveryDate && <span>🚚 Срок: {formatDate(p.plannedDeliveryDate)}</span>}
                          {p.supplyUser && <span>Снабженец: {p.supplyUser.name}</span>}
                        </div>
                        {p.supplyComment && (
                          <div style={{ fontStyle: 'italic', marginTop: '4px', color: '#cbd5e1' }}>
                            «{p.supplyComment}»
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  {/* AMOUNT */}
                  <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 'bold', fontSize: '0.95rem', verticalAlign: 'top' }}>
                    {p.amount > 0 ? `${p.amount.toLocaleString()} ₸` : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Не указана</span>}
                  </td>

                  {/* STATUS */}
                  <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>
                    {renderStatusBadge(p.status)}
                  </td>

                  {/* FILES & PDF */}
                  <td style={{ padding: '12px 10px', textAlign: 'center', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center' }}>
                      <button onClick={() => generatePurchasePDF(p)} className="inline-btn" style={{ background: '#3b82f6', color: '#fff', fontSize: '0.75rem', padding: '4px 8px' }}>
                        📄 Заявка PDF
                      </button>
                      
                      {p.invoiceFileUrl && (
                        <a href={p.invoiceFileUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: '#38bdf8', textDecoration: 'underline' }}>
                          📥 Счет поставщика
                        </a>
                      )}

                      {p.fileUrl && !p.invoiceFileUrl && (
                        <a href={p.fileUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: '#38bdf8', textDecoration: 'underline' }}>
                          📎 Вложение
                        </a>
                      )}
                    </div>
                  </td>

                  {/* ACTION BUTTONS ACCORDING TO ROLE & STATUS */}
                  <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      
                      {/* 1. GIP APPROVAL OF INITIAL NEED */}
                      {(p.status === 'PENDING_APPROVAL' || p.status === 'PENDING') && isGipOrManager && (
                        <>
                          <button 
                            onClick={() => updatePurchaseStatus(p.id, 'IN_PROCUREMENT')} 
                            className="inline-btn" 
                            style={{ background: '#10b981', color: '#fff' }}
                            title="Одобрить потребность и передать в снабжение"
                          >
                            ✅ В снабжение
                          </button>
                          <button 
                            onClick={() => updatePurchaseStatus(p.id, 'REJECTED')} 
                            className="inline-btn" 
                            style={{ background: '#ef4444', color: '#fff' }}
                            title="Отклонить заявку"
                          >
                            ❌
                          </button>
                        </>
                      )}

                      {/* 2. SUPPLY ACTION: PROCESS INVOICE */}
                      {(p.status === 'IN_PROCUREMENT' || p.status === 'PENDING_APPROVAL' || p.status === 'PENDING_PAYMENT_APPROVAL' || p.status === 'APPROVED') && isSupply && (
                        <button 
                          onClick={() => openSupplyModal(p)} 
                          className="inline-btn" 
                          style={{ background: '#3b82f6', color: '#fff' }}
                          title="Внести данные поставщика, счет и сумму"
                        >
                          📝 Внести счет
                        </button>
                      )}

                      {/* 3. GIP APPROVAL OF INVOICE PRICE */}
                      {p.status === 'PENDING_PAYMENT_APPROVAL' && isGipOrManager && (
                        <>
                          <button 
                            onClick={() => updatePurchaseStatus(p.id, 'APPROVED_FOR_PAYMENT')} 
                            className="inline-btn" 
                            style={{ background: '#10b981', color: '#fff' }}
                            title="Утвердить сумму счета и передать на оплату в бухгалтерию"
                          >
                            ✅ Утвердить к оплате
                          </button>
                          <button 
                            onClick={() => updatePurchaseStatus(p.id, 'IN_PROCUREMENT')} 
                            className="inline-btn" 
                            style={{ background: '#f59e0b', color: '#fff' }}
                            title="Вернуть снабженцу на пересогласование цены"
                          >
                            ↩️ Пересогласовать
                          </button>
                        </>
                      )}

                      {/* 4. ACCOUNTANT PAYMENT ACTION */}
                      {(p.status === 'APPROVED_FOR_PAYMENT' || p.status === 'APPROVED') && isAccountant && (
                        <button 
                          onClick={() => updatePurchaseStatus(p.id, 'PAID_AND_ORDERED')} 
                          className="inline-btn" 
                          style={{ background: '#10b981', color: '#fff' }}
                          title="Подтвердить оплату счета"
                        >
                          💳 Оплачено
                        </button>
                      )}

                      {/* 5. EXPENSE APPROVAL & PAYMENT */}
                      {p.status === 'PENDING_EXPENSE' && isGipOrManager && (
                        <>
                          <button 
                            onClick={() => updatePurchaseStatus(p.id, 'APPROVED_EXPENSE')} 
                            className="inline-btn" 
                            style={{ background: '#10b981', color: '#fff' }}
                            title="Одобрить чек подотчета"
                          >
                            ✅ Одобрить подотчет
                          </button>
                          <button 
                            onClick={() => updatePurchaseStatus(p.id, 'REJECTED')} 
                            className="inline-btn" 
                            style={{ background: '#ef4444', color: '#fff' }}
                          >
                            ❌
                          </button>
                        </>
                      )}

                      {p.status === 'APPROVED_EXPENSE' && isAccountant && (
                        <button 
                          onClick={() => updatePurchaseStatus(p.id, 'PAID_EXPENSE')} 
                          className="inline-btn" 
                          style={{ background: '#10b981', color: '#fff' }}
                          title="Выплатить подотчет"
                        >
                          💳 Выплатить
                        </button>
                      )}

                      {/* 6. DELIVERY ARRIVAL ACTION */}
                      {(p.status === 'PAID_AND_ORDERED' || p.status === 'PAID') && (isSupply || isWarehouse || isGipOrManager) && (
                        <button 
                          onClick={() => updatePurchaseStatus(p.id, 'DELIVERED')} 
                          className="inline-btn" 
                          style={{ background: '#14b8a6', color: '#fff' }}
                          title="Отметить прибытие ТМЦ на базу / объект"
                        >
                          📦 Доставлено на склад
                        </button>
                      )}

                      {/* 7. ADMIN CONTROLS */}
                      {role === 'ADMIN' && (
                        <>
                          <button onClick={() => setEditingPurchase(p)} className="inline-btn" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
                            ✏️
                          </button>
                          <button onClick={() => handleDeletePurchase(p.id)} className="inline-btn" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
                            🗑️
                          </button>
                        </>
                      )}

                    </div>
                  </td>

                </tr>
              ))}
              {filteredPurchases.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Заявок в этой категории не найдено.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SUPPLY PROCESSING MODAL */}
      {supplyModalPurchase && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="form-card" style={{ width: '550px', maxWidth: '100%', background: '#131b26', border: '1px solid #1e293b', borderRadius: '12px', padding: '25px' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#fff' }}>📦 Обработка снабжением (Счет на оплату)</h3>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '20px' }}>
              Заявка: <strong>{supplyModalPurchase.title}</strong> (Проект: {supplyModalPurchase.project?.name})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                  Поставщик (наименование ТОО / ИП) *
                </label>
                <input 
                  className="form-input" 
                  placeholder="Например: ТОО «ЭлектроСпецСнаб»" 
                  value={supplySupplierName} 
                  onChange={e => setSupplySupplierName(e.target.value)} 
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                    Номер счета
                  </label>
                  <input 
                    className="form-input" 
                    placeholder="№ 142/АЭА" 
                    value={supplyInvoiceNumber} 
                    onChange={e => setSupplyInvoiceNumber(e.target.value)} 
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                    Дата счета
                  </label>
                  <input 
                    type="date"
                    className="form-input" 
                    value={supplyInvoiceDate} 
                    onChange={e => setSupplyInvoiceDate(e.target.value)} 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                    Итоговая сумма по счету (₸) *
                  </label>
                  <input 
                    type="number"
                    className="form-input" 
                    placeholder="Сумма (KZT)" 
                    value={supplyAmount} 
                    onChange={e => setSupplyAmount(e.target.value)} 
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                    Плановый срок поставки
                  </label>
                  <input 
                    type="date"
                    className="form-input" 
                    value={supplyDeliveryDate} 
                    onChange={e => setSupplyDeliveryDate(e.target.value)} 
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                  Ссылка на PDF / скан счета от поставщика
                </label>
                <input 
                  className="form-input" 
                  placeholder="Ссылка на Google Drive / облако" 
                  value={supplyInvoiceFileUrl} 
                  onChange={e => setSupplyInvoiceFileUrl(e.target.value)} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                  Комментарий снабженца / условия (предоплата, доставка)
                </label>
                <input 
                  className="form-input" 
                  placeholder="Например: 100% предоплата, доставка за наш счет, срок 3 дня" 
                  value={supplyComment} 
                  onChange={e => setSupplyComment(e.target.value)} 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '15px' }}>
                <button 
                  type="button" 
                  className="inline-btn" 
                  onClick={() => setSupplyModalPurchase(null)}
                  style={{ background: 'rgba(255,255,255,0.1)' }}
                >
                  Отмена
                </button>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    type="button" 
                    className="inline-btn" 
                    onClick={() => handleSupplyModalSubmit('IN_PROCUREMENT')}
                    style={{ background: '#3b82f6', color: '#fff' }}
                  >
                    💾 Сохранить черновик
                  </button>
                  <button 
                    type="button" 
                    className="btn-submit" 
                    onClick={() => handleSupplyModalSubmit('PENDING_PAYMENT_APPROVAL')}
                    style={{ background: '#10b981', color: '#fff' }}
                  >
                    🚀 Отправить ГИПу на утверждение
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingPurchase && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="form-card" style={{ width: '450px', background: '#151b26' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Редактировать заявку #{editingPurchase.id}</h3>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input className="form-input" value={editingPurchase.title} onChange={e => setEditingPurchase({...editingPurchase, title: e.target.value})} required />
              <input className="form-input" type="number" value={editingPurchase.amount} onChange={e => setEditingPurchase({...editingPurchase, amount: e.target.value})} required />
              <select className="form-select" value={editingPurchase.projectId || ''} onChange={e => setEditingPurchase({...editingPurchase, projectId: e.target.value})}>
                <option value="">-- Без проекта --</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input className="form-input" placeholder="Поставщик" value={editingPurchase.supplierName || ''} onChange={e => setEditingPurchase({...editingPurchase, supplierName: e.target.value})} />
              <input className="form-input" placeholder="Номер счета" value={editingPurchase.invoiceNumber || ''} onChange={e => setEditingPurchase({...editingPurchase, invoiceNumber: e.target.value})} />
              <input className="form-input" placeholder="Ссылка на скан" value={editingPurchase.fileUrl || ''} onChange={e => setEditingPurchase({...editingPurchase, fileUrl: e.target.value})} />
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="inline-btn" onClick={() => setEditingPurchase(null)}>Отмена</button>
                <button type="submit" className="btn-submit">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HIDDEN PRINT COMPONENT */}
      <div style={{ display: 'none' }}>
        <PrintPurchaseRequest ref={purchasePrintRef} purchase={activePurchaseForPrint} />
      </div>

    </div>
  );
}
