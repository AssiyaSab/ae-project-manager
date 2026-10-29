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
        'НДС 12% (KZT)': s.vatAmount || 0,
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
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#a78bfa', marginBottom: '6px' }}>⚡ Продажи ONKA / WEG и доверенности</div>
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
    </div>
  );
}












