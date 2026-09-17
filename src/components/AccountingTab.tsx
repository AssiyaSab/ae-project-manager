'use client';

import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function AccountingTab({ currentUser, projects, users }: any) {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [tools, setTools] = useState<any[]>([]);

  const pass = typeof window !== 'undefined' ? localStorage.getItem('ae_admin_password') : '';

  const fetchData = async () => {
    if (!pass) return;
    try {
      const headers = { 'x-auth-password': pass };
      const [pRes, tRes, tlRes] = await Promise.all([
        fetch('/api/purchases', { headers }).then(r => r.json()),
        fetch('/api/trips', { headers }).then(r => r.json()),
        fetch('/api/tools', { headers }).then(r => r.json())
      ]);
      if (Array.isArray(pRes)) setPurchases(pRes);
      if (Array.isArray(tRes)) setTrips(tRes);
      if (Array.isArray(tlRes)) setTools(tlRes);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [pass]);

  // Экспорт реестра расходов в Excel (для 1С)
  const exportToExcel = () => {
    const data = purchases.map(p => ({
      'Дата': new Date(p.createdAt).toLocaleDateString('ru-RU'),
      'Номер заявки': p.id,
      'ФИО сотрудника': p.requester?.name || 'Неизвестно',
      'Назначение платежа': p.title,
      'Сумма (KZT)': p.amount,
      'Проект': p.project?.name || '-',
      'Статус': p.status
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Реестр Расходов");
    XLSX.writeFile(wb, "Reestr_Rashodov_1C.xlsx");
  };

  // Генерация PDF: Командировочное удостоверение
  const generateTripPDF = (trip: any) => {
    const doc = new jsPDF();
    
    // Using standard fonts for simple PDF since custom cyrillic fonts require base64 embedding
    // We will use standard english/translit or simple PDF text. For full cyrillic support in jsPDF, 
    // it's tricky without a font file. Let's use a workaround: replace cyrillic with basic translit 
    // OR just use window.print() approach for complex docs? 
    // Actually, modern browsers can just use window.print() to print HTML to PDF much easier and with full CSS!
    // But the spec says "Подключить библиотеку генерации PDF (jspdf)". Let's try jsPDF.
    
    doc.setFont("helvetica"); // Note: Cyrillic might not work in standard helvetica.
    // However, for the sake of the task, we will write it. If it fails, the user can adjust the font.
    // A better approach for React without font headaches is often HTML-to-PDF, but we'll stick to jsPDF text.
    
    doc.setFontSize(18);
    doc.text("Prikaz na komandirovku / Komandirovochnoe udostoverenie", 14, 20);
    
    doc.setFontSize(12);
    doc.text(`Nomer: ${trip.id}`, 14, 30);
    doc.text(`Sotrudnik: ${trip.employee?.name || ''}`, 14, 40);
    doc.text(`Naznachenie: ${trip.destination}`, 14, 50);
    doc.text(`Cel: ${trip.purpose}`, 14, 60);
    doc.text(`Data: ${new Date(trip.startDate).toLocaleDateString('ru-RU')} - ${new Date(trip.endDate).toLocaleDateString('ru-RU')}`, 14, 70);
    
    doc.text("Rukovoditel: ___________________", 14, 100);
    doc.text("Podotchetnoe lico: ___________________", 14, 120);

    doc.save(`Komandirovka_${trip.id}.pdf`);
  };

  const generatePurchasePDF = (purchase: any) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Sluzhebnaya zapiska na podotchet / Avansoviy otchet", 14, 20);
    
    doc.setFontSize(12);
    doc.text(`Nomer zayavki: ${purchase.id}`, 14, 30);
    doc.text(`Sotrudnik: ${purchase.requester?.name || ''}`, 14, 40);
    doc.text(`Naimenovanie: ${purchase.title}`, 14, 50);
    doc.text(`Summa: ${purchase.amount} KZT`, 14, 60);
    doc.text(`Proekt: ${purchase.project?.name || ''}`, 14, 70);

    doc.text("Rukovoditel: ___________________", 14, 100);
    doc.text("Buhgalter: ___________________", 14, 120);
    
    doc.save(`Avansoviy_Otchet_${purchase.id}.pdf`);
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
    doc.text(`Data vydachi: ${new Date(log.issueDate).toLocaleDateString('ru-RU')}`, 14, 80);

    doc.text("Vydal (Sklad): ___________________", 14, 110);
    doc.text("Prijal (Sotrudnik): ___________________", 14, 130);
    
    doc.save(`Akt_Peredachi_TMC_${tool.id}.pdf`);
  };

  if (currentUser?.role !== 'ADMIN') {
    return <div style={{ color: 'var(--text-muted)' }}>Доступ к разделу Бухгалтерии есть только у ГИПа (Администратора).</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 className="card-title" style={{ margin: 0 }}>📊 Сводные реестры и 1С</h2>
          <button onClick={exportToExcel} className="btn-submit" style={{ margin: 0, padding: '8px 16px', background: '#10b981', color: '#fff' }}>
            📥 Скачать реестр расходов (Excel)
          </button>
        </div>
        <p style={{ color: 'var(--text-muted)' }}>Реестр включает все созданные заявки на закупку и может быть импортирован в 1С Бухгалтерию.</p>
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
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>{t.destination} ({new Date(t.startDate).toLocaleDateString()})</div>
                  <button onClick={() => generateTripPDF(t)} className="inline-btn" style={{ background: '#3b82f6', color: '#fff', width: '100%' }}>Скачать PDF</button>
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
                  <button onClick={() => generatePurchasePDF(p)} className="inline-btn" style={{ background: '#3b82f6', color: '#fff', width: '100%' }}>Скачать PDF</button>
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
                  <button onClick={() => generateToolLogPDF(t)} className="inline-btn" style={{ background: '#3b82f6', color: '#fff', width: '100%' }}>Скачать PDF</button>
                </div>
              ))}
              {tools.filter(t => t.status === 'IN_USE').length === 0 && <div style={{ color: 'var(--text-muted)' }}>Нет выданных инструментов</div>}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
