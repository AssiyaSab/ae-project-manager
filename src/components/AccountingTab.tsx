'use client';

import React, { useState, useEffect } from 'react';
import { formatDate } from '@/lib/formatters';
import jsPDF from 'jspdf';
import { useReactToPrint } from 'react-to-print';
import { useRef } from 'react';
import PrintTripOrder from './PrintTripOrder';
import PrintPurchaseRequest from './PrintPurchaseRequest';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function AccountingTab({ currentUser, projects, users }: any) {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [tools, setTools] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);

  // Modal State for Issuing POA
  const [selectedPurchaseForPoa, setSelectedPurchaseForPoa] = useState<any>(null);
  const [poaNumber, setPoaNumber] = useState('');
  const [poaDate, setPoaDate] = useState(new Date().toISOString().split('T')[0]);
  const [poaIssuedTo, setPoaIssuedTo] = useState('');
  const [poaFileUrl, setPoaFileUrl] = useState('');
  const [isSubmittingPoa, setIsSubmittingPoa] = useState(false);

  const openPoaModal = (purchase: any) => {
    setSelectedPurchaseForPoa(purchase);
    setPoaNumber(purchase.poaNumber || `№ ${purchase.id}-Д`);
    setPoaDate(purchase.poaDate ? new Date(purchase.poaDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setPoaIssuedTo(purchase.poaIssuedTo || purchase.supplyUser?.name || '');
    setPoaFileUrl(purchase.poaFileUrl || '');
  };

  const handleSavePoa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poaNumber.trim() || !poaDate || !poaIssuedTo.trim()) {
      alert('Пожалуйста, укажите номер доверенности, дату и сотрудника, кому она выдана');
      return;
    }
    setIsSubmittingPoa(true);
    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-auth-password': pass || '',
        'x-admin-password': pass || '',
        'x-auth-login': typeof window !== 'undefined' ? localStorage.getItem('ae_auth_login') || '' : ''
      };

      const res = await fetch('/api/purchases', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          id: selectedPurchaseForPoa.id,
          status: 'POA_ISSUED',
          poaNumber: poaNumber.trim(),
          poaDate: poaDate,
          poaIssuedTo: poaIssuedTo.trim(),
          poaFileUrl: poaFileUrl.trim() || null
        })
      });

      if (res.ok) {
        alert(`Доверенность ${poaNumber} успешно зарегистрирована! Снабженец уведомлен в Telegram о возможности забрать товар у поставщика.`);
        setSelectedPurchaseForPoa(null);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Ошибка при сохранении доверенности');
      }
    } catch (err) {
      console.error(err);
      alert('Ошибка соединения с сервером');
    } finally {
      setIsSubmittingPoa(false);
    }
  };

  const pass = typeof window !== 'undefined' ? localStorage.getItem('ae_admin_password') : '';

  const fetchData = async () => {
    if (!pass) return;
    try {
      const headers = { 
        'x-auth-password': pass,
        'x-admin-password': pass,
        'x-auth-login': typeof window !== 'undefined' ? localStorage.getItem('ae_auth_login') || '' : ''
      };
      const [pRes, tRes, tlRes, sRes] = await Promise.all([
        fetch('/api/purchases', { headers }).then(r => r.json()),
        fetch('/api/trips', { headers }).then(r => r.json()),
        fetch('/api/tools', { headers }).then(r => r.json()),
        fetch('/api/sales', { headers }).then(r => r.json()).catch(() => [])
      ]);
      if (Array.isArray(pRes)) setPurchases(pRes);
      if (Array.isArray(tRes)) setTrips(tRes);
      if (Array.isArray(tlRes)) setTools(tlRes);
      if (Array.isArray(sRes)) setSales(sRes);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [pass]);

  // Экспорт реестра расходов в Excel (для 1С)
  const exportToExcel = () => {
    try {
      const data = purchases.map(p => ({
        'Дата': formatDate(p.createdAt),
        'ID заявки': p.id,
        'Тип': p.type === 'EXPENSE' ? 'Подотчет / Чек' : 'Счет на ТОО',
        'ФИО сотрудника': p.requester?.name || 'Неизвестно',
        'Назначение платежа': p.title,
        'Поставщик': p.supplierName || '-',
        'Номер счета': p.invoiceNumber || '-',
        'Сумма (KZT)': p.amount,
        'Срок поставки': p.plannedDeliveryDate ? formatDate(p.plannedDeliveryDate) : '-',
        'Проект': p.project?.name || '-',
        'Номер доверенности Д-1': p.poaNumber || '-',
        'Дата доверенности': p.poaDate ? formatDate(p.poaDate) : '-',
        'Доверенность выдана на': p.poaIssuedTo || '-',
        'Статус': p.status
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Реестр расходов");
      
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Reestr_Rashodov_1C.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      alert("Реестр расходов успешно выгружен в Excel!");
    } catch (e) {
      console.error(e);
      alert("Произошла ошибка при выгрузке в Excel. Проверьте, установлена ли библиотека xlsx.");
    }
  };

  // Экспорт реестра закрытых продаж оборудования (ONKA / WEG) для проведения накладных в 1С
  const exportSalesToExcel = () => {
    try {
      const closedSales = sales.filter(s => s.status === 'SHIPPED' || s.status === 'PAID');
      const salesToExport = closedSales.length > 0 ? closedSales : sales;

      const data = salesToExport.map(s => ({
        'Номер счета': s.orderNumber,
        'Дата счета': formatDate(s.invoiceDate || s.createdAt),
        'Покупатель': s.customerName,
        'БИН / ИИН': s.customerBin || '-',
        'Телефон': s.customerPhone || '-',
        'Адрес': s.customerAddress || '-',
        'Бренд': s.brand || 'ONKA',
        'Кол-во позиций': s.items?.length || 0,
        'Сумма без НДС (KZT)': Math.round(((s.totalAmount || 0) - (s.vatAmount || 0)) * 100) / 100,
        'НДС 16% (KZT)': s.vatAmount || 0,
        'Всего с НДС (KZT)': s.totalAmount || 0,
        'Статус оплаты': s.paidAt ? `Оплачено (${formatDate(s.paidAt)})` : (s.status === 'PAID' ? 'Оплачено' : 'Ожидает оплаты'),
        'Статус отгрузки': s.status === 'SHIPPED' ? 'Отгружен (Закрыт)' : s.status,
        'Дата фактической отгрузки': s.shippedAt ? formatDate(s.shippedAt) : '-',
        'Номер доверенности': s.powerOfAttorneyNumber || '-',
        'Дата доверенности': s.powerOfAttorneyDate ? formatDate(s.powerOfAttorneyDate) : '-',
        'ФИО получателя по доверенности': s.issuedToName || '-',
        'Скан доверенности (URL)': s.powerOfAttorneyFileUrl || '-',
        'Кладовщик (отпустил товар)': s.warehouseUser?.name || 'Склад',
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Продажи и доверенности 1С");
      
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Reestr_Prodazh_ONKA_WEG_1C.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      alert("Реестр закрытых продаж и доверенностей для 1С успешно выгружен в Excel!");
    } catch (e) {
      console.error(e);
      alert("Ошибка при выгрузке реестра продаж в Excel.");
    }
  };

  const handleDeleteTrip = async (id: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту командировку?')) return;
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

  const handleDeletePurchase = async (id: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту заявку?')) return;
    try {
      await fetch('/api/purchases?id=' + id, {
        method: 'DELETE',
        headers: { 'x-admin-password': pass || '', 'x-auth-password': pass || '', 'x-auth-login': localStorage.getItem('ae_auth_login') || '' }
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelToolAct = async (id: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот акт? Инструмент будет возвращен на склад.')) return;
    try {
      await fetch('/api/tools', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': pass || '', 'x-auth-password': pass || '', 'x-auth-login': localStorage.getItem('ae_auth_login') || '' },
        body: JSON.stringify({ id, status: 'AVAILABLE' })
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };
  // Генерация PDF: Командировочное удостоверение
  const tripPrintRef = useRef(null);
  const [activeTripForPrint, setActiveTripForPrint] = useState<any>(null);
  const handlePrintTrip = useReactToPrint({
    contentRef: tripPrintRef,
    documentTitle: 'Prikaz_O_Komandirovanii'
  });

  const purchasePrintRef = useRef(null);
  const [activePurchaseForPrint, setActivePurchaseForPrint] = useState<any>(null);
  const handlePrintPurchase = useReactToPrint({
    contentRef: purchasePrintRef,
    documentTitle: 'Zayavka_Na_Rashody'
  });

  const generateTripPDF = (trip: any) => {
    setActiveTripForPrint(trip);
    setTimeout(() => {
      handlePrintTrip();
    }, 100);
  };

  const generatePurchasePDF = (purchase: any) => {
    setActivePurchaseForPrint(purchase);
    setTimeout(() => {
      handlePrintPurchase();
    }, 100);
  };

  const generateToolLogPDF = (tool: any) => {
    const log = tool.logs[0];
    if (!log) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Akt priema-peredachi TMC", 14, 20);
    
    doc.setFontSize(12);
    doc.text(`Instrument: ${tool.name} (Inv. nomer: ${tool.serialNumber || 'N/A'})`, 14, 40);
    doc.text(`Kategoriya: ${tool.category}`, 14, 50);
    doc.text(`Vydan sotrudniku: ${log.employee?.name || ''}`, 14, 60);
    doc.text(`Proekt/Obekt: ${log.project?.name || '-'}`, 14, 70);
    doc.text(`Data vydachi: ${formatDate(log.issueDate)}`, 14, 80);

    doc.text("Vydal (Sklad): ___________________", 14, 110);
    doc.text("Prijal (Sotrudnik): ___________________", 14, 130);
    
    doc.save(`Akt_Peredachi_TMC_${tool.id}.pdf`);
  };

  if (currentUser?.role !== 'ADMIN' && currentUser?.role !== 'ACCOUNTANT') {
    return <div style={{ color: 'var(--text-muted)' }}>Доступ к разделу Бухгалтерии есть только у Директора и Бухгалтера.</div>;
  }

  const shippedSalesCount = sales.filter(s => s.status === 'SHIPPED').length;
  const totalSalesRevenue = sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* 1. Модуль интеграции с 1С (Выгрузка расходов и закрытых продаж) */}
      <div className="card">
        <h2 className="card-title" style={{ marginBottom: '15px' }}>📊 Сводные реестры для 1С:Предприятие</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          
          {/* Расходы и закупки */}
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#38bdf8', marginBottom: '6px' }}>🛒 Реестр расходов и закупок ТМЦ</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 14px 0' }}>
                Включает все безналичные счета поставщиков и подотчетные чеки сотрудников с привязкой к проектам.
              </p>
            </div>
            <button onClick={exportToExcel} className="btn-submit" style={{ margin: 0, padding: '10px 16px', background: '#10b981', color: '#fff', fontWeight: 600 }}>
              📥 Скачать реестр расходов (Excel)
            </button>
          </div>

          {/* Продажи оборудования и доверенности */}
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#a78bfa', marginBottom: '6px' }}>💼 Продажи и доверенности (1С)</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 8px 0' }}>
                Закрытые продажи со всеми реквизитами покупателей, номерами и датами доверенностей для проведения расходных накладных в 1С.
              </p>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Всего закрыто отгрузок: <strong style={{ color: '#34d399' }}>{shippedSalesCount}</strong> | Общий оборот: <strong>{totalSalesRevenue.toLocaleString('ru-RU')} ₸</strong>
              </div>
            </div>
            <button onClick={exportSalesToExcel} className="btn-submit" style={{ margin: 0, padding: '10px 16px', background: '#8b5cf6', color: '#fff', fontWeight: 600 }}>
              📥 Скачать продажи и доверенности 1С (Excel)
            </button>
          </div>

        </div>
      </div>

      {/* 2. Оформление доверенностей формы Д-1 на получение ТМЦ */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <div>
            <h2 className="card-title" style={{ margin: 0 }}>📜 Доверенности формы Д-1 на получение ТМЦ</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
              После оплаты счетов поставщиков бухгалтер оформляет официальную доверенность для снабженца/экспедитора
            </p>
          </div>
          <span style={{ 
            padding: '4px 12px', 
            borderRadius: '12px', 
            background: purchases.filter(p => p.status === 'PAID_AND_ORDERED').length > 0 ? '#f59e0b20' : '#10b98120', 
            color: purchases.filter(p => p.status === 'PAID_AND_ORDERED').length > 0 ? '#fbbf24' : '#34d399',
            fontSize: '0.85rem',
            fontWeight: 600,
            border: '1px solid currentColor'
          }}>
            {purchases.filter(p => p.status === 'PAID_AND_ORDERED').length} ждут доверенности
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px' }}>ID / Дата оплаты</th>
                <th style={{ padding: '10px' }}>Проект / ТМЦ</th>
                <th style={{ padding: '10px' }}>Поставщик / Счет</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Сумма</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Статус</th>
                <th style={{ padding: '10px' }}>Доверенность (Д-1)</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Действие</th>
              </tr>
            </thead>
            <tbody>
              {purchases.filter(p => ['PAID_AND_ORDERED', 'POA_ISSUED', 'IN_TRANSIT', 'DELIVERED'].includes(p.status)).map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px' }}>
                    <div style={{ fontWeight: 'bold' }}>#{p.id}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.paidAt ? formatDate(p.paidAt) : formatDate(p.createdAt)}</div>
                  </td>
                  <td style={{ padding: '10px' }}>
                    <div style={{ fontWeight: 600 }}>{p.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.project?.name || 'Без проекта'}</div>
                  </td>
                  <td style={{ padding: '10px' }}>
                    <div>{p.supplierName || 'Поставщик не указан'}</div>
                    {p.invoiceNumber && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Счет №{p.invoiceNumber}</div>}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>
                    {p.amount.toLocaleString()} ₸
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    {p.status === 'PAID_AND_ORDERED' && <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', background: '#f59e0b20', color: '#fbbf24', border: '1px solid #f59e0b40' }}>Оплачен (Нужна Д-1)</span>}
                    {p.status === 'POA_ISSUED' && <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', background: '#8b5cf620', color: '#a78bfa', border: '1px solid #8b5cf640' }}>Доверенность выдана</span>}
                    {p.status === 'IN_TRANSIT' && <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', background: '#3b82f620', color: '#60a5fa', border: '1px solid #3b82f640' }}>Везем на склад</span>}
                    {p.status === 'DELIVERED' && <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', background: '#10b98120', color: '#34d399', border: '1px solid #10b98140' }}>Принято на склад</span>}
                  </td>
                  <td style={{ padding: '10px' }}>
                    {p.poaNumber ? (
                      <div>
                        <div style={{ fontWeight: 600, color: '#a78bfa' }}>{p.poaNumber} {p.poaDate ? `от ${formatDate(p.poaDate)}` : ''}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Выдана: {p.poaIssuedTo}</div>
                        {p.poaFileUrl && (
                          <a href={p.poaFileUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: '#38bdf8', textDecoration: 'underline' }}>
                            Скан Д-1
                          </a>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Не оформлена</span>
                    )}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>
                    {p.status === 'PAID_AND_ORDERED' ? (
                      <button 
                        onClick={() => openPoaModal(p)} 
                        className="inline-btn"
                        style={{ background: '#8b5cf6', color: '#fff', fontWeight: 600, padding: '6px 12px' }}
                      >
                        📜 Выдать доверенность
                      </button>
                    ) : (
                      <button 
                        onClick={() => openPoaModal(p)} 
                        className="inline-btn"
                        style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', padding: '4px 8px', fontSize: '0.75rem' }}
                        title="Редактировать данные доверенности"
                      >
                        Редакт. Д-1
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {purchases.filter(p => ['PAID_AND_ORDERED', 'POA_ISSUED', 'IN_TRANSIT', 'DELIVERED'].includes(p.status)).length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Нет оплаченных счетов, требующих оформления доверенности.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">🖨 Печатные формы (PDF)</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '10px' }}>Командировочные удостоверения</h3>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
              {trips.filter(t => t.status === 'APPROVED' || t.status === 'COMPLETED').map(t => (
                <div key={t.id} style={{ padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', minWidth: '250px' }}>
                  <div style={{ fontWeight: 'bold' }}>{t.employee?.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>{t.destination} ({formatDate(t.startDate)})</div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => generateTripPDF(t)} className="inline-btn" style={{ background: '#3b82f6', color: '#fff', flex: 1 }}>Скачать PDF</button>
                    <button onClick={() => handleDeleteTrip(t.id)} className="inline-btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>🗑️</button>
                  </div>
                </div>
              ))}
              {trips.filter(t => t.status === 'APPROVED' || t.status === 'COMPLETED').length === 0 && <div style={{ color: 'var(--text-muted)' }}>Нет согласованных командировок</div>}
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '10px' }}>Авансовые отчеты (Расходы)</h3>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
              {purchases.filter(p => p.status === 'APPROVED' || p.status === 'PAID').map(p => (
                <div key={p.id} style={{ padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', minWidth: '250px' }}>
                  <div style={{ fontWeight: 'bold' }}>{p.title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>{p.amount.toLocaleString()} ₸ ({p.project?.name})</div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => generatePurchasePDF(p)} className="inline-btn" style={{ background: '#3b82f6', color: '#fff', flex: 1 }}>Скачать PDF</button>
                    <button onClick={() => handleDeletePurchase(p.id)} className="inline-btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>🗑️</button>
                  </div>
                </div>
              ))}
              {purchases.filter(p => p.status === 'APPROVED' || p.status === 'PAID').length === 0 && <div style={{ color: 'var(--text-muted)' }}>Нет согласованных закупок</div>}
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '10px' }}>Акты приема-передачи (Инструмент)</h3>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
              {tools.filter(t => t.status === 'IN_USE').map(t => (
                <div key={t.id} style={{ padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', minWidth: '250px' }}>
                  <div style={{ fontWeight: 'bold' }}>{t.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>На руках: {t.holder?.name}</div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => generateToolLogPDF(t)} className="inline-btn" style={{ background: '#3b82f6', color: '#fff', flex: 1 }}>Скачать PDF</button>
                    <button onClick={() => handleCancelToolAct(t.id)} className="inline-btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>🗑️</button>
                  </div>
                </div>
              ))}
              {tools.filter(t => t.status === 'IN_USE').length === 0 && <div style={{ color: 'var(--text-muted)' }}>Нет выданных инструментов</div>}
            </div>
          </div>        </div>
      </div>
      
      {/* Invisible Print Components */}
      <div style={{ display: 'none' }}>
        <PrintTripOrder ref={tripPrintRef} trip={activeTripForPrint} />
        <PrintPurchaseRequest ref={purchasePrintRef} purchase={activePurchaseForPrint} />
      </div>

      {/* MODAL: ВЫДАЧА ДОВЕРЕННОСТИ ФОРМЫ Д-1 */}
      {selectedPurchaseForPoa && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ maxWidth: '540px', width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
                📜 Оформление доверенности (форма Д-1)
              </h3>
              <button onClick={() => setSelectedPurchaseForPoa(null)} className="inline-btn" style={{ padding: '4px 10px' }}>✕</button>
            </div>

            <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.3)', marginBottom: '18px', fontSize: '0.85rem' }}>
              <div>По закупке: <strong>#{selectedPurchaseForPoa.id} — {selectedPurchaseForPoa.title}</strong></div>
              <div>Поставщик: <strong>{selectedPurchaseForPoa.supplierName || 'Поставщик'}</strong> (Счет №{selectedPurchaseForPoa.invoiceNumber || 'б/н'})</div>
              <div>Сумма: <strong>{selectedPurchaseForPoa.amount.toLocaleString()} ₸</strong></div>
            </div>

            <form onSubmit={handleSavePoa} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Номер доверенности *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="№ 24-Д"
                  value={poaNumber}
                  onChange={e => setPoaNumber(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Дата выдачи доверенности *</label>
                <input
                  type="date"
                  className="form-input"
                  value={poaDate}
                  onChange={e => setPoaDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Кому выдана доверенность (ФИО экспедитора / снабженца) *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Иванов Иван Иванович (по удостоверению)"
                  value={poaIssuedTo}
                  onChange={e => setPoaIssuedTo(e.target.value)}
                  required
                  list="employees-list"
                />
                <datalist id="employees-list">
                  {users?.map((u: any) => (
                    <option key={u.id} value={u.name} />
                  ))}
                </datalist>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Скан / Фото доверенности (ссылка или URL)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="https://... или ссылка из Telegram"
                  value={poaFileUrl}
                  onChange={e => setPoaFileUrl(e.target.value)}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                  Прикрепите ссылку на подписанный скан документа для снабженца.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedPurchaseForPoa(null)}
                  className="inline-btn"
                  style={{ padding: '8px 16px' }}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPoa}
                  className="btn-submit"
                  style={{ padding: '8px 22px', background: '#8b5cf6', color: '#fff', fontWeight: 700, margin: 0 }}
                >
                  {isSubmittingPoa ? 'Сохранение...' : 'Зарегистрировать доверенность'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}












