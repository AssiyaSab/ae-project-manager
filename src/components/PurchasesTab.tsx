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
  const [purchaseItems, setPurchaseItems] = useState<{ name: string; quantity: number; unit: string; price?: number }[]>([]);
  const [isParsingSpec, setIsParsingSpec] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!pass && !currentUser) return;
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
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/purchases', {
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
          fileUrl: purchaseFileUrl,
          items: purchaseItems.filter(item => item.name.trim().length > 0)
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Не удалось создать заявку. Проверьте заполненные поля.');
        return;
      }
      setPurchaseTitle(''); 
      setPurchaseAmount(''); 
      setPurchaseProject(''); 
      setPurchaseFileUrl('');
      setPurchaseItems([]);
      setUploadedFile(null);
      setStatusFilter('ALL');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchData();
    } catch (e: any) {
      console.error(e);
      alert('Ошибка сети при создании заявки: ' + (e?.message || 'Неизвестная ошибка'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const handleParseSpec = async () => {
    if (!uploadedFile && !purchaseFileUrl.trim()) {
      alert('Пожалуйста, вставьте ссылку на Google Диск / Таблицу или прикрепите файл Excel/PDF для распознавания');
      return;
    }

    setIsParsingSpec(true);
    try {
      let res: Response;
      if (uploadedFile) {
        const formData = new FormData();
        formData.append('file', uploadedFile);
        if (purchaseFileUrl.trim()) {
          formData.append('googleDriveUrl', purchaseFileUrl.trim());
        }
        res = await fetch('/api/purchases/parse-spec', {
          method: 'POST',
          headers: {
            'x-auth-password': pass || '',
            'x-auth-login': localStorage.getItem('ae_auth_login') || ''
          },
          body: formData
        });
      } else {
        res = await fetch('/api/purchases/parse-spec', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-password': pass || '',
            'x-auth-login': localStorage.getItem('ae_auth_login') || ''
          },
          body: JSON.stringify({ googleDriveUrl: purchaseFileUrl.trim() })
        });
      }

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Ошибка при распознавании спецификации');
        return;
      }

      if (Array.isArray(data.items) && data.items.length > 0) {
        setPurchaseItems(prev => [...prev, ...data.items]);
        if (!purchaseTitle) {
          const firstItem = data.items[0]?.name || 'ТМЦ';
          setPurchaseTitle(`Закупка: ${firstItem.slice(0, 45)}${data.items.length > 1 ? ` (+${data.items.length - 1} поз.)` : ''}`);
        }
      } else {
        alert('ИИ не обнаружил позиций ТМЦ в документе. Проверьте содержимое файла.');
      }
    } catch (err: any) {
      console.error('handleParseSpec error:', err);
      alert('Сбой при обращении к сервису распознавания: ' + (err?.message || 'Неизвестная ошибка'));
    } finally {
      setIsParsingSpec(false);
    }
  };

  const handleAddItemRow = () => {
    setPurchaseItems(prev => [...prev, { name: '', quantity: 1, unit: 'шт' }]);
  };

  const handleUpdateItemRow = (index: number, field: string, val: any) => {
    setPurchaseItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const handleRemoveItemRow = (index: number) => {
    setPurchaseItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearItems = () => {
    if (purchaseItems.length === 0 || window.confirm('Очистить все распознанные позиции?')) {
      setPurchaseItems([]);
    }
  };

  const updatePurchaseStatus = async (id: number, status: string, extraData: any = {}) => {
    try {
      const res = await fetch('/api/purchases', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json', 
          'x-admin-password': pass || '', 
          'x-auth-password': pass || '', 
          'x-auth-login': localStorage.getItem('ae_auth_login') || '' 
        },
        body: JSON.stringify({ id, status, ...extraData })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Ошибка при обновлении статуса');
        return;
      }
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleApproveInvoice = async (p: any) => {
    let pinCode: string | undefined = undefined;
    if (p.amount >= 500000) {
      const enteredPin = window.prompt(`🔒 Крупная сумма счета (${p.amount.toLocaleString()} ₸ превышает 500 000 ₸).\nВведите ваш персональный 4-значный ПИН-код для подтверждения:`);
      if (!enteredPin) return;
      pinCode = enteredPin.trim();
    }
    await updatePurchaseStatus(p.id, 'APPROVED_FOR_PAYMENT', { pinCode });
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
        text = '1. ЖДЕТ ДИРЕКТОРА';
        bg = 'rgba(245, 158, 11, 0.2)';
        color = '#f59e0b';
        break;
      case 'IN_PROCUREMENT':
        text = '2. В СНАБЖЕНИИ';
        bg = 'rgba(59, 130, 246, 0.2)';
        color = '#3b82f6';
        break;
      case 'PENDING_PAYMENT_APPROVAL':
        text = '3. СЧЕТ ГОТОВ (ЖДЕТ ДИРЕКТОРА)';
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
        text = '5. ОПЛАЧЕНО';
        bg = 'rgba(16, 185, 129, 0.2)';
        color = '#10b981';
        break;
      case 'POA_ISSUED':
        text = '5. ДОВЕРЕННОСТЬ Д-1 ВЫДАНА';
        bg = 'rgba(139, 92, 246, 0.2)';
        color = '#a78bfa';
        break;
      case 'IN_TRANSIT':
        text = '6. ГРУЗ В ПУТИ / ВЕЗЕМ В ЦЕХ';
        bg = 'rgba(59, 130, 246, 0.2)';
        color = '#60a5fa';
        break;
      case 'DELIVERED':
        text = '7. ДОСТАВЛЕНО / НА СКЛАДЕ';
        bg = 'rgba(20, 184, 166, 0.2)';
        color = '#2dd4bf';
        break;
      case 'PENDING_EXPENSE':
        text = 'ПОДОТЧЕТ (ЖДЕТ ДИРЕКТОРА)';
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
    if (statusFilter === 'POA_ISSUED') return p.status === 'POA_ISSUED';
    if (statusFilter === 'IN_TRANSIT') return ['IN_TRANSIT', 'POA_ISSUED', 'PAID_AND_ORDERED', 'PAID'].includes(p.status);
    if (statusFilter === 'DELIVERED') return p.status === 'DELIVERED';
    if (statusFilter === 'REJECTED') return p.status === 'REJECTED';
    return true;
  });

  const role = currentUser?.role;
  const isGipOrManager = ['ADMIN', 'MANAGER'].includes(role);
  const isSupply = ['SUPPLY', 'ADMIN'].includes(role);
  const isChiefAccountant = currentUser?.role === 'ADMIN' || currentUser?.role === 'CHIEF_ACCOUNTANT' || (currentUser?.role === 'ACCOUNTANT' && currentUser?.title?.toLowerCase().includes('главн'));
  const isAccountant = ['ACCOUNTANT', 'CHIEF_ACCOUNTANT', 'ADMIN'].includes(role);
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

          <div style={{ flex: '2 1 320px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
              {purchaseType === 'INVOICE' ? 'Ссылка на спецификацию / Google Диск (опц.)' : 'Ссылка на скан/чек (опц.)'}
            </label>
            <input 
              className="form-input" 
              placeholder={purchaseType === 'INVOICE' ? 'https://drive.google.com/... или docs.google.com/...' : 'Google Drive / ссылка'} 
              value={purchaseFileUrl} 
              onChange={e => setPurchaseFileUrl(e.target.value)} 
            />
            {purchaseType === 'INVOICE' && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  accept=".xlsx,.xls,.csv,.docx,.doc,.pdf,image/*,.jpg,.jpeg,.png,.webp,.bmp" 
                  onChange={handleFileChange} 
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-btn"
                  style={{ 
                    fontSize: '0.75rem', 
                    padding: '5px 10px', 
                    background: uploadedFile ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.08)', 
                    color: uploadedFile ? '#34d399' : '#e2e8f0', 
                    border: uploadedFile ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '6px'
                  }}
                  title="Выбрать файл (Excel, Word, PDF или фото) с компьютера/смартфона"
                >
                  {uploadedFile ? `📎 ${uploadedFile.name.length > 22 ? uploadedFile.name.slice(0, 20) + '...' : uploadedFile.name}` : '📎 Загрузить Excel / Word / PDF / Фото'}
                </button>
                {uploadedFile && (
                  <button
                    type="button"
                    onClick={() => { setUploadedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.9rem', padding: '0 4px' }}
                    title="Удалить прикрепленный файл"
                  >
                    ✕
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleParseSpec}
                  disabled={isParsingSpec || (!uploadedFile && !purchaseFileUrl.trim())}
                  className="inline-btn"
                  style={{ 
                    fontSize: '0.75rem', 
                    padding: '5px 12px', 
                    background: isParsingSpec ? '#475569' : 'linear-gradient(135deg, #7c3aed, #2563eb)', 
                    color: '#fff', 
                    fontWeight: 600,
                    borderRadius: '6px',
                    opacity: (!uploadedFile && !purchaseFileUrl.trim()) ? 0.45 : 1,
                    cursor: (isParsingSpec || (!uploadedFile && !purchaseFileUrl.trim())) ? 'not-allowed' : 'pointer',
                    boxShadow: (!uploadedFile && !purchaseFileUrl.trim()) ? 'none' : '0 2px 8px rgba(124, 58, 237, 0.3)'
                  }}
                  title="Распознать позиции спецификации с помощью ИИ (Gemini)"
                >
                  {isParsingSpec ? '⏳ Распознавание ИИ...' : '✨ Заполнить список из файла'}
                </button>
              </div>
            )}
          </div>

          <div style={{ flex: '0 1 160px', display: 'flex', alignItems: 'flex-start', marginTop: '22px' }}>
            <button 
              className="btn-submit" 
              type="submit" 
              disabled={isSubmitting}
              style={{ 
                width: '100%', 
                height: '42px', 
                background: isSubmitting ? '#475569' : (purchaseType === 'INVOICE' ? '#3b82f6' : '#f59e0b'), 
                color: '#fff', 
                fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer'
              }}
            >
              {isSubmitting ? '⏳ Сохранение...' : (purchaseType === 'INVOICE' ? '🚀 В снабжение' : '💰 На подотчет')}
            </button>
          </div>

          {/* Interactive table of PurchaseItem */}
          {purchaseType === 'INVOICE' && (
            <div style={{ 
              flex: '1 1 100%', 
              marginTop: '15px', 
              padding: '16px', 
              background: 'rgba(15, 23, 42, 0.65)', 
              border: '1px solid rgba(148, 163, 184, 0.15)', 
              borderRadius: '8px' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📋 Спецификация позиций ТМЦ</span>
                  <span style={{ fontSize: '0.75rem', background: '#3b82f6', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                    {purchaseItems.length} поз.
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="inline-btn"
                    style={{ fontSize: '0.75rem', padding: '4px 10px', background: '#2563eb', color: '#fff', borderRadius: '6px' }}
                  >
                    ➕ Добавить позицию
                  </button>
                  {purchaseItems.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearItems}
                      className="inline-btn"
                      style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px' }}
                    >
                      Очистить
                    </button>
                  )}
                </div>
              </div>

              {purchaseItems.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '6px' }}>
                  Список позиций пока пуст. Загрузите файл Excel, Word, PDF или фото документа/чека (либо вставьте ссылку на Google Диск / Таблицу) и нажмите <strong>«✨ Заполнить список из файла»</strong>, либо добавьте позиции кнопкой <strong>«➕ Добавить позицию»</strong>.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', maxHeight: '350px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', color: 'var(--text-muted)', textAlign: 'left' }}>
                        <th style={{ padding: '8px 6px', width: '35px', textAlign: 'center' }}>№</th>
                        <th style={{ padding: '8px 6px' }}>Наименование и характеристики *</th>
                        <th style={{ padding: '8px 6px', width: '100px', textAlign: 'center' }}>Кол-во *</th>
                        <th style={{ padding: '8px 6px', width: '90px', textAlign: 'center' }}>Ед. изм.</th>
                        <th style={{ padding: '8px 6px', width: '40px', textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseItems.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                          <td style={{ padding: '6px', textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                          <td style={{ padding: '4px 6px' }}>
                            <input
                              className="form-input"
                              style={{ width: '100%', fontSize: '0.85rem', padding: '5px 8px' }}
                              value={item.name}
                              onChange={e => handleUpdateItemRow(idx, 'name', e.target.value)}
                              placeholder="Наименование ТМЦ / артикул"
                              required
                            />
                          </td>
                          <td style={{ padding: '4px 6px' }}>
                            <input
                              type="number"
                              step="any"
                              min="0.01"
                              className="form-input"
                              style={{ width: '100%', fontSize: '0.85rem', padding: '5px 6px', textAlign: 'center' }}
                              value={item.quantity}
                              onChange={e => handleUpdateItemRow(idx, 'quantity', parseFloat(e.target.value) || 1)}
                              required
                            />
                          </td>
                          <td style={{ padding: '4px 6px' }}>
                            <input
                              className="form-input"
                              style={{ width: '100%', fontSize: '0.85rem', padding: '5px 6px', textAlign: 'center' }}
                              value={item.unit}
                              onChange={e => handleUpdateItemRow(idx, 'unit', e.target.value)}
                              placeholder="шт"
                            />
                          </td>
                          <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }}
                              title="Удалить строку"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
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
            ⏳ Ждут Директора
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
            onClick={() => setStatusFilter('POA_ISSUED')} 
            className="inline-btn" 
            style={{ background: statusFilter === 'POA_ISSUED' ? '#8b5cf6' : 'rgba(255,255,255,0.05)', color: '#fff' }}
          >
            📜 Доверенность Д-1
          </button>

          <button 
            onClick={() => setStatusFilter('IN_TRANSIT')} 
            className="inline-btn" 
            style={{ background: statusFilter === 'IN_TRANSIT' ? '#3b82f6' : 'rgba(255,255,255,0.05)', color: '#fff' }}
          >
            🚚 В пути
          </button>

          <button 
            onClick={() => setStatusFilter('DELIVERED')} 
            className="inline-btn" 
            style={{ background: statusFilter === 'DELIVERED' ? '#14b8a6' : 'rgba(255,255,255,0.05)', color: '#fff' }}
          >
            ✅ На складе
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

                    {p.items && p.items.length > 0 && (
                      <div style={{ marginTop: '5px' }}>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          background: 'rgba(56, 189, 248, 0.1)', 
                          color: '#38bdf8', 
                          border: '1px solid rgba(56, 189, 248, 0.25)', 
                          padding: '2px 8px', 
                          borderRadius: '10px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          📦 Спецификация: <strong>{p.items.length} поз.</strong>
                        </span>
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

                    {/* POA (ДОВЕРЕННОСТЬ Д-1) INFO */}
                    {p.poaNumber && (
                      <div style={{ 
                        marginTop: '8px', 
                        padding: '8px 12px', 
                        background: 'rgba(139, 92, 246, 0.08)', 
                        border: '1px solid rgba(139, 92, 246, 0.25)', 
                        borderRadius: '6px', 
                        fontSize: '0.8rem' 
                      }}>
                        <div style={{ fontWeight: 600, color: '#c4b5fd' }}>
                          📜 Доверенность Д-1 №{p.poaNumber} {p.poaDate ? `от ${formatDate(p.poaDate)}` : ''}
                        </div>
                        <div style={{ display: 'flex', gap: '15px', marginTop: '3px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                          {p.poaIssuedTo && <span>Выдана на: <strong>{p.poaIssuedTo}</strong></span>}
                          {p.poaFileUrl && (
                            <a href={p.poaFileUrl} target="_blank" rel="noreferrer" style={{ color: '#93c5fd', textDecoration: 'underline' }}>
                              📥 Скан доверенности
                            </a>
                          )}
                        </div>
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
                            onClick={() => handleApproveInvoice(p)} 
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

                      {/* 4. CHIEF ACCOUNTANT PAYMENT ACTION */}
                      {(p.status === 'APPROVED_FOR_PAYMENT' || p.status === 'APPROVED') && (
                        isChiefAccountant ? (
                          <button 
                            onClick={() => updatePurchaseStatus(p.id, 'PAID_AND_ORDERED')} 
                            className="inline-btn" 
                            style={{ background: '#10b981', color: '#fff', fontWeight: 600 }}
                            title="Главный бухгалтер: подтвердить оплату счета"
                          >
                            💳 Оплачено
                          </button>
                        ) : isAccountant ? (
                          <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontStyle: 'italic', alignSelf: 'center' }}>
                            ⏳ Ждет оплаты Главбухом
                          </span>
                        ) : null
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

                      {p.status === 'APPROVED_EXPENSE' && (
                        isChiefAccountant ? (
                          <button 
                            onClick={() => updatePurchaseStatus(p.id, 'PAID_EXPENSE')} 
                            className="inline-btn" 
                            style={{ background: '#10b981', color: '#fff', fontWeight: 600 }}
                            title="Главный бухгалтер: выплатить подотчет"
                          >
                            💳 Выплатить
                          </button>
                        ) : isAccountant ? (
                          <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontStyle: 'italic', alignSelf: 'center' }}>
                            ⏳ К выплате (Главбух)
                          </span>
                        ) : null
                      )}

                      {/* 6. SUPPLY: PICKED UP AT SUPPLIER / IN TRANSIT */}
                      {(p.status === 'POA_ISSUED' || p.status === 'PAID_AND_ORDERED' || p.status === 'PAID') && (isSupply || isGipOrManager) && (
                        <button 
                          onClick={() => updatePurchaseStatus(p.id, 'IN_TRANSIT')} 
                          className="inline-btn" 
                          style={{ background: '#3b82f6', color: '#fff', fontWeight: 600 }}
                          title="Товар получен у поставщика / Везем на склад"
                        >
                          🚚 Везем на склад
                        </button>
                      )}

                      {/* 7. WAREHOUSE: RECEIVE AT WAREHOUSE */}
                      {(p.status === 'IN_TRANSIT' || p.status === 'POA_ISSUED' || p.status === 'PAID_AND_ORDERED' || p.status === 'PAID') && (isWarehouse || isGipOrManager) && (
                        <button 
                          onClick={() => updatePurchaseStatus(p.id, 'DELIVERED')} 
                          className="inline-btn" 
                          style={{ background: '#14b8a6', color: '#fff', fontWeight: 600 }}
                          title="Кладовщик проверил и принял ТМЦ на склад"
                        >
                          📦 Принять на склад
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
                    🚀 Отправить Директору на утверждение
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
