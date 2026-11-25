import React, { useState, useEffect, useRef } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ru } from 'date-fns/locale';
import { formatDate } from '@/lib/formatters';
import { useReactToPrint } from 'react-to-print';
import PrintPurchaseRequest from './PrintPurchaseRequest';
import { useToast } from './ToastProvider';
import { fileToCompressedDataUrl, compressImageIfNeeded } from '@/lib/imageCompression';
import FilePreviewModal, { formatTelegramOrFileUrl } from './FilePreviewModal';

export default function PurchasesTab({ currentUser, projects, users, highlightPurchaseId }: any) {
  const { showToast } = useToast();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [confirmedKey, setConfirmedKey] = useState<string | null>(null);

  useEffect(() => {
    if (highlightPurchaseId) {
      setStatusFilter('ALL');
      setDisciplineFilter('ALL');
      setProjectFilter('ALL');
      setTimeout(() => {
        const el = document.getElementById(`purchase-row-${highlightPurchaseId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 250);
    }
  }, [highlightPurchaseId, purchases.length]);

  // Creation State
  const [purchaseType, setPurchaseType] = useState<'INVOICE' | 'EXPENSE'>('INVOICE');
  const [purchaseDiscipline, setPurchaseDiscipline] = useState<'KIP' | 'ELECTRO' | 'GENERAL'>('GENERAL');
  const [purchaseTitle, setPurchaseTitle] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [purchaseProject, setPurchaseProject] = useState('');
  const [purchaseFileUrl, setPurchaseFileUrl] = useState('');
  const [directToDirector, setDirectToDirector] = useState(false);
  const [directInvoiceFileUrl, setDirectInvoiceFileUrl] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<{ name: string; quantity: number; unit: string; price?: number }[]>([]);
  const [isParsingSpec, setIsParsingSpec] = useState(false);
  const [parseProgress, setParseProgress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [disciplineFilter, setDisciplineFilter] = useState<string>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');

  // Supply Processing Modal State
  const [supplyModalPurchase, setSupplyModalPurchase] = useState<any>(null);
  const [supplySupplierName, setSupplySupplierName] = useState('');
  const [supplyInvoiceNumber, setSupplyInvoiceNumber] = useState('');
  const [supplyInvoiceDate, setSupplyInvoiceDate] = useState('');
  const [supplyAmount, setSupplyAmount] = useState('');
  const [supplyDeliveryDate, setSupplyDeliveryDate] = useState('');
  const [supplyComment, setSupplyComment] = useState('');
  const [supplyInvoiceFileUrl, setSupplyInvoiceFileUrl] = useState('');
  const [supplyInvoiceFile, setSupplyInvoiceFile] = useState<File | null>(null);
  const [isParsingInvoice, setIsParsingInvoice] = useState(false);
  const supplyFileInputRef = useRef<HTMLInputElement>(null);

  // Edit State
  const [editingPurchase, setEditingPurchase] = useState<any>(null);

  // POA (Доверенность Д-1) Modal State
  const [poaModalPurchase, setPoaModalPurchase] = useState<any>(null);
  const [poaNumber, setPoaNumber] = useState('');
  const [poaDate, setPoaDate] = useState('');
  const [poaIssuedTo, setPoaIssuedTo] = useState('');
  const [poaFileUrl, setPoaFileUrl] = useState('');
  const [poaIsEdo, setPoaIsEdo] = useState(false);

  // Expanded Items & Multi-Invoice Modal State
  const [expandedPurchaseIds, setExpandedPurchaseIds] = useState<number[]>([]);
  const [multiInvoiceModalPurchase, setMultiInvoiceModalPurchase] = useState<any>(null);
  const [multiInvSupplier, setMultiInvSupplier] = useState('');
  const [multiInvNumber, setMultiInvNumber] = useState('');
  const [multiInvAmount, setMultiInvAmount] = useState('');
  const [multiInvFileUrl, setMultiInvFileUrl] = useState('');
  const [multiInvItemIds, setMultiInvItemIds] = useState<number[]>([]);

  // Warehouse Delivery Note Modal State
  const [deliveryModalPurchase, setDeliveryModalPurchase] = useState<any>(null);
  const [deliveryNoteUrl, setDeliveryNoteUrl] = useState('');
  const [previewFile, setPreviewFile] = useState<{ url: string; title: string } | null>(null);

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
          'x-auth-login': localStorage.getItem('ae_auth_login') || currentUser?.login || '' 
        },
        body: JSON.stringify({
          type: purchaseType,
          discipline: purchaseDiscipline,
          title: purchaseTitle,
          amount: purchaseAmount ? Number(purchaseAmount) : 0,
          projectId: purchaseProject,
          fileUrl: purchaseFileUrl,
          directToDirector: role === 'MANAGER' && purchaseType === 'INVOICE' && directToDirector,
          invoiceFileUrl: role === 'MANAGER' && purchaseType === 'INVOICE' && directToDirector ? directInvoiceFileUrl : undefined,
          requesterId: currentUser?.id && currentUser.id > 0 && currentUser.id !== 999 ? currentUser.id : undefined,
          items: purchaseItems.filter(item => item.name.trim().length > 0)
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Не удалось создать заявку', 'error');
        return;
      }
      setPurchaseTitle(''); 
      setPurchaseAmount(''); 
      setPurchaseProject(''); 
      setPurchaseFileUrl('');
      setDirectToDirector(false);
      setDirectInvoiceFileUrl('');
      setPurchaseItems([]);
      showToast('✅ Заявка успешно создана', 'success');
      setUploadedFiles([]);
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
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      setUploadedFiles(prev => {
        const existingKeys = new Set(prev.map(f => `${f.name}_${f.size}`));
        const uniqueNew = selected.filter(f => !existingKeys.has(`${f.name}_${f.size}`));
        return [...prev, ...uniqueNew];
      });
      e.target.value = '';
    }
  };

  const handleRemoveUploadedFile = (idx: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleParseSpec = async () => {
    if (uploadedFiles.length === 0 && !purchaseFileUrl.trim()) {
      alert('Пожалуйста, вставьте ссылку на Google Диск / Таблицу или прикрепите хотя бы один файл для распознавания');
      return;
    }

    setIsParsingSpec(true);
    setParseProgress('');
    const collectedItems: { name: string; quantity: number; unit: string; price?: number }[] = [];
    const errors: string[] = [];

    try {
      // 1. Обрабатываем все выбранные локальные файлы по очереди
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        setParseProgress(`⏳ Файл ${i + 1}/${uploadedFiles.length}: ${file.name.length > 16 ? file.name.slice(0, 14) + '...' : file.name}`);
        try {
          const formData = new FormData();
          formData.append('file', file);
          const res = await fetch('/api/purchases/parse-spec', {
            method: 'POST',
            headers: {
              'x-auth-password': pass || '',
              'x-auth-login': localStorage.getItem('ae_auth_login') || ''
            },
            body: formData
          });
          const data = await res.json();
          if (!res.ok) {
            errors.push(`${file.name}: ${data.error || 'Ошибка распознавания'}`);
          } else if (Array.isArray(data.items) && data.items.length > 0) {
            collectedItems.push(...data.items);
          } else {
            errors.push(`${file.name}: позиции не найдены`);
          }
        } catch (fileErr: any) {
          errors.push(`${file.name}: ${fileErr?.message || 'Ошибка сети'}`);
        }
      }

      // 2. Если также указана ссылка на Google Диск — обрабатываем и её
      if (purchaseFileUrl.trim()) {
        setParseProgress('⏳ Читаю ссылку Google Диск...');
        try {
          const res = await fetch('/api/purchases/parse-spec', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-auth-password': pass || '',
              'x-auth-login': localStorage.getItem('ae_auth_login') || ''
            },
            body: JSON.stringify({ googleDriveUrl: purchaseFileUrl.trim() })
          });
          const data = await res.json();
          if (!res.ok) {
            errors.push(`Ссылка Google Диск: ${data.error || 'Ошибка распознавания'}`);
          } else if (Array.isArray(data.items) && data.items.length > 0) {
            collectedItems.push(...data.items);
          } else if (uploadedFiles.length === 0) {
            errors.push('По ссылке позиции ТМЦ не найдены');
          }
        } catch (urlErr: any) {
          errors.push(`Ссылка Google Диск: ${urlErr?.message || 'Ошибка сети'}`);
        }
      }

      if (collectedItems.length > 0) {
        setPurchaseItems(prev => [...prev, ...collectedItems]);
        if (!purchaseTitle) {
          const firstItem = collectedItems[0]?.name || 'ТМЦ';
          setPurchaseTitle(`Закупка: ${firstItem.slice(0, 45)}${collectedItems.length > 1 ? ` (+${collectedItems.length - 1} поз.)` : ''}`);
        }
      }

      if (errors.length > 0) {
        alert(
          (collectedItems.length > 0
            ? `Добавлено позиций: ${collectedItems.length}.\n\nНе удалось полностью обработать:\n`
            : 'Не удалось распознать позиции:\n') + errors.join('\n')
        );
      } else if (collectedItems.length === 0) {
        alert('ИИ не обнаружил позиций ТМЦ в документах. Проверьте содержимое файлов.');
      }
    } catch (err: any) {
      console.error('handleParseSpec error:', err);
      alert('Сбой при обращении к сервису распознавания: ' + (err?.message || 'Неизвестная ошибка'));
    } finally {
      setIsParsingSpec(false);
      setParseProgress('');
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

  const updatePurchaseStatus = async (id: number, status: string, extraData: any = {}, actionKey?: string) => {
    const key = actionKey || `pur_${id}_${status}`;
    if (loadingKey === key) return;
    setLoadingKey(key);
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
        showToast(data.error || 'Ошибка при обновлении статуса', 'error');
        return;
      }
      setConfirmedKey(key);
      showToast('✅ Статус заявки обновлен', 'success');
      setTimeout(() => setConfirmedKey((prev) => (prev === key ? null : prev)), 1800);
      fetchData();
    } catch (e) {
      console.error(e);
      showToast('Ошибка сети при обновлении статуса', 'error');
    } finally {
      setLoadingKey(null);
    }
  };

  const handleApproveInvoice = async (p: any) => {
    let pinCode: string | undefined = undefined;
    if (p.amount >= 500000) {
      const enteredPin = window.prompt(`🔒 Крупная сумма счета (${p.amount.toLocaleString()} ₸ превышает 500 000 ₸).\nВведите ваш персональный 4-значный ПИН-код для подтверждения:`);
      if (!enteredPin) return;
      pinCode = enteredPin.trim();
    }
    await updatePurchaseStatus(p.id, 'APPROVED_FOR_PAYMENT', { pinCode }, `pur_${p.id}_APPROVED_FOR_PAYMENT`);
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
    setSupplyInvoiceFile(null);
    if (supplyFileInputRef.current) supplyFileInputRef.current.value = '';
  };

  const handleSupplyFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const rawFile = e.target.files[0];
      const file = await compressImageIfNeeded(rawFile);
      setSupplyInvoiceFile(file);
      if (file.size <= 3.5 * 1024 * 1024) {
        const dataUrl = await fileToCompressedDataUrl(file);
        setSupplyInvoiceFileUrl(dataUrl);
      } else {
        showToast('Файл больше 3.5 МБ: лучше вставить ссылку на Google Диск', 'info');
      }
    }
  };

  const handleParseSupplyInvoice = async () => {
    const hasLink = supplyInvoiceFileUrl.trim() && !supplyInvoiceFileUrl.startsWith('data:');
    if (!supplyInvoiceFile && !hasLink) {
      alert('Прикрепите файл счета (PDF/фото) или вставьте ссылку на Google Диск');
      return;
    }
    setIsParsingInvoice(true);
    try {
      let res: Response;
      if (supplyInvoiceFile) {
        const formData = new FormData();
        formData.append('file', supplyInvoiceFile);
        res = await fetch('/api/purchases/parse-invoice', {
          method: 'POST',
          headers: {
            'x-auth-password': pass || '',
            'x-auth-login': localStorage.getItem('ae_auth_login') || ''
          },
          body: formData
        });
      } else {
        res = await fetch('/api/purchases/parse-invoice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-password': pass || '',
            'x-auth-login': localStorage.getItem('ae_auth_login') || ''
          },
          body: JSON.stringify({ googleDriveUrl: supplyInvoiceFileUrl.trim() })
        });
      }
      const result = await res.json();
      if (!res.ok) {
        alert(result.error || 'Не удалось распознать счет');
        return;
      }
      const d = result.data || {};
      if (d.supplierName) setSupplySupplierName(d.supplierName);
      if (d.invoiceNumber) setSupplyInvoiceNumber(d.invoiceNumber);
      if (d.invoiceDate) setSupplyInvoiceDate(d.invoiceDate);
      if (d.amount > 0) setSupplyAmount(String(d.amount));
      if (d.comment && !supplyComment) setSupplyComment(d.comment);
    } catch (err: any) {
      alert('Ошибка при распознавании счета: ' + (err?.message || 'Неизвестная ошибка'));
    } finally {
      setIsParsingInvoice(false);
    }
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
          discipline: editingPurchase.discipline || 'GENERAL',
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

  const openPoaModal = (p: any) => {
    setPoaModalPurchase(p);
    setPoaNumber(p.poaNumber || '');
    setPoaDate(p.poaDate ? new Date(p.poaDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setPoaIssuedTo(p.poaIssuedTo || p.supplyUser?.name || '');
    setPoaFileUrl(p.poaFileUrl || '');
    setPoaIsEdo(Boolean(p.poaIsEdo));
  };

  const handlePoaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poaModalPurchase) return;
    const key = `poa_${poaModalPurchase.id}`;
    if (loadingKey === key) return;
    setLoadingKey(key);
    try {
      const res = await fetch('/api/purchases', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': pass || '',
          'x-auth-password': pass || '',
          'x-auth-login': localStorage.getItem('ae_auth_login') || ''
        },
        body: JSON.stringify({
          id: poaModalPurchase.id,
          status: 'POA_ISSUED',
          poaNumber: poaNumber.trim(),
          poaDate: poaDate || null,
          poaIssuedTo: poaIssuedTo.trim(),
          poaFileUrl: poaIsEdo ? null : (poaFileUrl.trim() || null),
          poaIsEdo,
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Не удалось сохранить доверенность', 'error');
        return;
      }
      showToast(poaIsEdo ? '📡 Доверенность Д-1 (ЭДО) оформлена' : '📜 Доверенность Д-1 оформлена', 'success');
      setPoaModalPurchase(null);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingKey(null);
    }
  };

  const toggleExpandPurchase = (id: number) => {
    setExpandedPurchaseIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleMarkItemFromStock = async (purchaseId: number, itemId: number) => {
    const key = `item_stock_${itemId}`;
    if (loadingKey === key) return;
    setLoadingKey(key);
    try {
      const res = await fetch('/api/purchases', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': pass || '',
          'x-auth-password': pass || '',
          'x-auth-login': localStorage.getItem('ae_auth_login') || ''
        },
        body: JSON.stringify({ id: purchaseId, action: 'MARK_ITEM_FROM_STOCK', itemId })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Ошибка списания со склада', 'error');
        return;
      }
      showToast('📦 Позиция закрыта со склада', 'success');
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingKey(null);
    }
  };

  const openMultiInvoiceModal = (p: any) => {
    setMultiInvoiceModalPurchase(p);
    setMultiInvSupplier('');
    setMultiInvNumber('');
    setMultiInvAmount('');
    setMultiInvFileUrl('');
    const pendingIds = (p.items || []).filter((it: any) => it.sourceType === 'PENDING').map((it: any) => it.id);
    setMultiInvItemIds(pendingIds);
  };

  const handleCreateMultiInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!multiInvoiceModalPurchase) return;
    const key = `multi_inv_create_${multiInvoiceModalPurchase.id}`;
    if (loadingKey === key) return;
    setLoadingKey(key);
    try {
      const res = await fetch('/api/purchases/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': pass || '',
          'x-auth-password': pass || '',
          'x-auth-login': localStorage.getItem('ae_auth_login') || ''
        },
        body: JSON.stringify({
          purchaseId: multiInvoiceModalPurchase.id,
          supplierName: multiInvSupplier.trim(),
          invoiceNumber: multiInvNumber.trim(),
          amount: Number(multiInvAmount),
          fileUrl: multiInvFileUrl.trim() || null,
          itemIds: multiInvItemIds,
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Ошибка добавления счета', 'error');
        return;
      }
      showToast('✅ Счет на оплату добавлен', 'success');
      setMultiInvoiceModalPurchase(null);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingKey(null);
    }
  };

  const handleMultiInvoiceAction = async (invoiceId: number, action: 'APPROVE' | 'PAY' | 'REJECT', amount: number) => {
    let pinCode: string | undefined;
    if (action === 'APPROVE' && amount >= 500000) {
      const entered = window.prompt(`🔒 Сумма счета ${amount.toLocaleString('ru-RU')} ₸ >= 500 000 ₸. Введите 4-значный ПИН-код:`);
      if (!entered) return;
      pinCode = entered.trim();
    }
    const key = `inv_${invoiceId}_${action}`;
    if (loadingKey === key) return;
    setLoadingKey(key);
    try {
      const res = await fetch('/api/purchases/invoices', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': pass || '',
          'x-auth-password': pass || '',
          'x-auth-login': localStorage.getItem('ae_auth_login') || ''
        },
        body: JSON.stringify({ invoiceId, action, pinCode })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Ошибка обновления счета', 'error');
        return;
      }
      setConfirmedKey(key);
      showToast(action === 'PAY' ? '💳 Счет оплачен, позиции отмечены' : '✅ Счет обновлен', 'success');
      setTimeout(() => setConfirmedKey((prev) => (prev === key ? null : prev)), 1800);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingKey(null);
    }
  };

  const handleDeliveryConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryModalPurchase) return;
    await updatePurchaseStatus(
      deliveryModalPurchase.id,
      'DELIVERED',
      { deliveryNoteUrl: deliveryNoteUrl.trim() || null },
      `pur_${deliveryModalPurchase.id}_DELIVERED`
    );
    setDeliveryModalPurchase(null);
    setDeliveryNoteUrl('');
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

    if (disciplineFilter !== 'ALL') {
      if ((p.discipline || 'GENERAL') !== disciplineFilter) return false;
    }

    if (projectFilter !== 'ALL') {
      if (String(p.projectId) !== projectFilter) return false;
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

  // Аналитика затрат по направлениям (исключая отклоненные заявки, в разрезе выбранного проекта)
  const analyticsScope = purchases.filter(p => p.status !== 'REJECTED' && (projectFilter === 'ALL' || String(p.projectId) === projectFilter));
  const analytics = {
    kipSum: analyticsScope.filter(p => p.discipline === 'KIP').reduce((s, p) => s + (p.amount || 0), 0),
    kipCount: analyticsScope.filter(p => p.discipline === 'KIP').length,
    electroSum: analyticsScope.filter(p => p.discipline === 'ELECTRO').reduce((s, p) => s + (p.amount || 0), 0),
    electroCount: analyticsScope.filter(p => p.discipline === 'ELECTRO').length,
    generalSum: analyticsScope.filter(p => !p.discipline || p.discipline === 'GENERAL').reduce((s, p) => s + (p.amount || 0), 0),
    generalCount: analyticsScope.filter(p => !p.discipline || p.discipline === 'GENERAL').length,
  };

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

          <div style={{ flex: '1 1 220px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
              Направление (для аналитики)
            </label>
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.04)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', height: '42px', alignItems: 'center' }}>
              {[
                { key: 'KIP', label: '🎛️ КИПиА', color: '#0ea5e9' },
                { key: 'ELECTRO', label: '⚡ Электрика', color: '#f59e0b' },
                { key: 'GENERAL', label: '📦 Общее', color: '#64748b' },
              ].map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setPurchaseDiscipline(opt.key as any)}
                  style={{
                    flex: 1,
                    height: '100%',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: purchaseDiscipline === opt.key ? opt.color : 'transparent',
                    color: purchaseDiscipline === opt.key ? '#fff' : 'var(--text-muted)',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                    padding: '0 6px'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
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
              <div style={{ marginTop: '8px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input 
                    type="file" 
                    multiple
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
                      background: uploadedFiles.length > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.08)', 
                      color: uploadedFiles.length > 0 ? '#34d399' : '#e2e8f0', 
                      border: uploadedFiles.length > 0 ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '6px'
                    }}
                    title="Выбрать один или несколько файлов (Excel, Word, PDF или фото) с компьютера/смартфона"
                  >
                    {uploadedFiles.length > 0 ? `📎 Добавить ещё файлы (${uploadedFiles.length})` : '📎 Загрузить файлы (Excel / Word / PDF / Фото)'}
                  </button>
                  <button
                    type="button"
                    onClick={handleParseSpec}
                    disabled={isParsingSpec || (uploadedFiles.length === 0 && !purchaseFileUrl.trim())}
                    className="inline-btn"
                    style={{ 
                      fontSize: '0.75rem', 
                      padding: '5px 12px', 
                      background: isParsingSpec ? '#475569' : 'linear-gradient(135deg, #7c3aed, #2563eb)', 
                      color: '#fff', 
                      fontWeight: 600,
                      borderRadius: '6px',
                      opacity: (uploadedFiles.length === 0 && !purchaseFileUrl.trim()) ? 0.45 : 1,
                      cursor: (isParsingSpec || (uploadedFiles.length === 0 && !purchaseFileUrl.trim())) ? 'not-allowed' : 'pointer',
                      boxShadow: (uploadedFiles.length === 0 && !purchaseFileUrl.trim()) ? 'none' : '0 2px 8px rgba(124, 58, 237, 0.3)'
                    }}
                    title="Распознать позиции спецификации с помощью ИИ (Gemini)"
                  >
                    {isParsingSpec ? (parseProgress || '⏳ Распознавание ИИ...') : '✨ Заполнить список из файлов'}
                  </button>
                </div>

                {uploadedFiles.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                    {uploadedFiles.map((file, idx) => (
                      <span
                        key={`${file.name}_${file.size}_${idx}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.72rem',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          background: 'rgba(16, 185, 129, 0.14)',
                          border: '1px solid rgba(16, 185, 129, 0.35)',
                          color: '#6ee7b7',
                        }}
                      >
                        <span title={file.name}>
                          {file.name.length > 25 ? file.name.slice(0, 22) + '...' : file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveUploadedFile(idx)}
                          style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.8rem', padding: 0, lineHeight: 1 }}
                          title="Удалить файл"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
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
          {role === 'MANAGER' && purchaseType === 'INVOICE' && (
            <div style={{ marginTop: '14px', padding: '12px 14px', background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', color: '#c4b5fd' }}>
                <input
                  type="checkbox"
                  checked={directToDirector}
                  onChange={(e) => setDirectToDirector(e.target.checked)}
                />
                ⚡ Прикрепить счет сразу (минуя снабжение, напрямую Директору)
              </label>
              {directToDirector && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                  <div style={{ flex: '1 1 180px' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Сумма счета (₸) *</label>
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      placeholder="Сумма счета"
                      value={purchaseAmount}
                      onChange={(e) => setPurchaseAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div style={{ flex: '2 1 280px' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Файл счета (PDF / фото) или ссылка</label>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input
                        className="form-input"
                        placeholder="https://... или загрузите файл"
                        value={directInvoiceFileUrl}
                        onChange={(e) => setDirectInvoiceFileUrl(e.target.value)}
                      />
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        style={{ maxWidth: '160px', fontSize: '0.75rem' }}
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const url = await fileToCompressedDataUrl(f);
                          setDirectInvoiceFileUrl(url);
                          showToast('📎 Счет прикреплен и сжат', 'info');
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </form>

        {/* АНАЛИТИКА И ФИЛЬТР ПО НАПРАВЛЕНИЯМ (КИПиА / ЭЛЕКТРИКА) */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap', alignItems: 'center', padding: '12px 15px', background: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>📊 Аналитика:</span>
            <select 
              className="form-select" 
              style={{ width: 'auto', minWidth: '190px', padding: '5px 10px', fontSize: '0.8rem', height: '32px' }}
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
            >
              <option value="ALL">Все проекты</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
            <button
              type="button"
              onClick={() => setDisciplineFilter('ALL')}
              className="inline-btn"
              style={{ fontSize: '0.78rem', padding: '5px 12px', background: disciplineFilter === 'ALL' ? '#334155' : 'var(--bg-card)', color: disciplineFilter === 'ALL' ? '#fff' : 'var(--text-primary)', border: disciplineFilter === 'ALL' ? '1px solid #64748b' : '1px solid var(--border-color)' }}
            >
              Все направления
            </button>
            <button
              type="button"
              onClick={() => setDisciplineFilter(disciplineFilter === 'KIP' ? 'ALL' : 'KIP')}
              className="inline-btn"
              style={{ fontSize: '0.78rem', padding: '5px 12px', background: disciplineFilter === 'KIP' ? 'rgba(14, 165, 233, 0.25)' : 'rgba(14, 165, 233, 0.08)', color: '#0284c7', border: disciplineFilter === 'KIP' ? '1px solid #0ea5e9' : '1px solid rgba(14, 165, 233, 0.35)' }}
            >
              🎛️ КИПиА ({analytics.kipCount}): <strong>{analytics.kipSum.toLocaleString('ru-RU')} ₸</strong>
            </button>
            <button
              type="button"
              onClick={() => setDisciplineFilter(disciplineFilter === 'ELECTRO' ? 'ALL' : 'ELECTRO')}
              className="inline-btn"
              style={{ fontSize: '0.78rem', padding: '5px 12px', background: disciplineFilter === 'ELECTRO' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(245, 158, 11, 0.08)', color: '#d97706', border: disciplineFilter === 'ELECTRO' ? '1px solid #f59e0b' : '1px solid rgba(245, 158, 11, 0.35)' }}
            >
              ⚡ Электрика ({analytics.electroCount}): <strong>{analytics.electroSum.toLocaleString('ru-RU')} ₸</strong>
            </button>
            <button
              type="button"
              onClick={() => setDisciplineFilter(disciplineFilter === 'GENERAL' ? 'ALL' : 'GENERAL')}
              className="inline-btn"
              style={{ fontSize: '0.78rem', padding: '5px 12px', background: disciplineFilter === 'GENERAL' ? '#475569' : 'var(--bg-card)', color: disciplineFilter === 'GENERAL' ? '#fff' : 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
            >
              📦 Общее ({analytics.generalCount}): <strong>{analytics.generalSum.toLocaleString('ru-RU')} ₸</strong>
            </button>
          </div>
        </div>

        {/* FILTERS */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
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
                <React.Fragment key={p.id}>
                <tr
                  id={`purchase-row-${p.id}`}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    background: highlightPurchaseId === p.id ? 'rgba(59, 130, 246, 0.14)' : undefined,
                    outline: highlightPurchaseId === p.id ? '2px solid #3b82f6' : undefined,
                  }}
                >
                  
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
                    <div style={{ marginTop: '4px' }}>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: p.discipline === 'KIP' ? 'rgba(14, 165, 233, 0.15)' : p.discipline === 'ELECTRO' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(148, 163, 184, 0.12)',
                        color: p.discipline === 'KIP' ? '#38bdf8' : p.discipline === 'ELECTRO' ? '#fbbf24' : '#94a3b8',
                        border: p.discipline === 'KIP' ? '1px solid rgba(14, 165, 233, 0.3)' : p.discipline === 'ELECTRO' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(148, 163, 184, 0.2)',
                        display: 'inline-block'
                      }}>
                        {p.discipline === 'KIP' ? '🎛️ КИПиА' : p.discipline === 'ELECTRO' ? '⚡ Электрика' : '📦 Общее'}
                      </span>
                    </div>
                  </td>

                  {/* REQUESTER */}
                  <td style={{ padding: '12px 10px', verticalAlign: 'top', width: '160px' }}>
                    <div style={{ fontWeight: 700 }}>{p.requester?.name || 'Администрация (Мастер-аккаунт)'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: '2px' }}>
                      {p.requester?.title || (p.requester?.role ? ({ ADMIN: 'Директор', MANAGER: 'Руководитель', CHIEF_ACCOUNTANT: 'Главный бухгалтер', ACCOUNTANT: 'Бухгалтер', SUPPLY: 'Снабженец', WAREHOUSE: 'Кладовщик', ENGINEER: 'Инженер', ASSEMBLER: 'Сборщик' }[p.requester.role as string] || p.requester.role) : 'ГИП / Руководство')}
                    </div>
                  </td>

                  {/* TITLE, PROJECT & SUPPLIER DETAILS */}
                  <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{p.title}</div>
                    
                    {p.project && (
                      <div style={{ fontSize: '0.8rem', color: '#38bdf8', marginTop: '2px' }}>
                        Проект: {p.project.name}
                      </div>
                    )}

                    {p.items && p.items.length > 0 && (() => {
                      const stockCount = p.items.filter((it: any) => it.sourceType === 'FROM_STOCK').length;
                      const invCount = p.items.filter((it: any) => it.sourceType === 'INVOICE').length;
                      const closedCount = stockCount + invCount;
                      const isAllClosed = closedCount === p.items.length;
                      const isExpanded = expandedPurchaseIds.includes(p.id);
                      return (
                        <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{
                            fontSize: '0.74rem',
                            background: isAllClosed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.1)',
                            color: isAllClosed ? '#34d399' : '#38bdf8',
                            border: isAllClosed ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(56, 189, 248, 0.25)',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 600
                          }}>
                            {isAllClosed
                              ? `✅ Все позиции закрыты (100% — ${p.items.length} поз.)`
                              : `Закрыто: ${closedCount} из ${p.items.length} поз. (Склад: ${stockCount}, Счета: ${invCount})`}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleExpandPurchase(p.id)}
                            className="inline-btn"
                            style={{ fontSize: '0.72rem', padding: '2px 8px', background: 'rgba(255,255,255,0.08)', color: '#e2e8f0' }}
                          >
                            {isExpanded ? '▲ Скрыть позиции' : '▼ Позиции и счета'}
                          </button>
                        </div>
                      );
                    })()}
                    {(!p.items || p.items.length === 0) && p.invoices && p.invoices.length > 0 && (
                      <div style={{ marginTop: '6px' }}>
                        <button
                          type="button"
                          onClick={() => toggleExpandPurchase(p.id)}
                          className="inline-btn"
                          style={{ fontSize: '0.72rem', padding: '2px 8px', background: 'rgba(255,255,255,0.08)', color: '#e2e8f0' }}
                        >
                          {expandedPurchaseIds.includes(p.id) ? '▲ Скрыть счета' : `▼ Счета (${p.invoices.length})`}
                        </button>
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
                        <div style={{ fontWeight: 600, color: '#c4b5fd', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span>📜 Доверенность Д-1 №{p.poaNumber} {p.poaDate ? `от ${formatDate(p.poaDate)}` : ''}</span>
                          {p.poaIsEdo && (
                            <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: '10px', background: 'rgba(14, 165, 233, 0.2)', color: '#38bdf8', border: '1px solid rgba(14, 165, 233, 0.4)' }}>
                              📡 Отправлено по ЭДО
                            </span>
                          )}
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

                      {p.fileUrl && (
                        <button
                          type="button"
                          onClick={() => setPreviewFile({ url: formatTelegramOrFileUrl(p.fileUrl), title: `📎 Чек / Спецификация (Заявка #${p.id})` })}
                          className="inline-btn"
                          style={{ background: 'rgba(56, 189, 248, 0.14)', color: '#38bdf8', fontSize: '0.73rem', padding: '3px 8px' }}
                        >
                          📎 Чек / Спецификация
                        </button>
                      )}

                      {p.invoiceFileUrl && (
                        <button
                          type="button"
                          onClick={() => setPreviewFile({ url: p.invoiceFileUrl.startsWith('data:') ? `/api/purchases/invoice-file?id=${p.id}` : formatTelegramOrFileUrl(p.invoiceFileUrl), title: `📄 Счет поставщика (Заявка #${p.id})` })}
                          className="inline-btn"
                          style={{ background: 'rgba(139, 92, 246, 0.16)', color: '#c4b5fd', fontSize: '0.73rem', padding: '3px 8px' }}
                        >
                          📄 Счет поставщика
                        </button>
                      )}

                      {p.poaFileUrl && (
                        <button
                          type="button"
                          onClick={() => setPreviewFile({ url: formatTelegramOrFileUrl(p.poaFileUrl), title: `📑 Доверенность Д-1 (Заявка #${p.id})` })}
                          className="inline-btn"
                          style={{ background: 'rgba(167, 139, 250, 0.16)', color: '#a78bfa', fontSize: '0.73rem', padding: '3px 8px' }}
                        >
                          📑 Доверенность Д-1
                        </button>
                      )}

                      {p.deliveryNoteUrl && (
                        <button
                          type="button"
                          onClick={() => setPreviewFile({ url: formatTelegramOrFileUrl(p.deliveryNoteUrl), title: `🚚 Накладная (Заявка #${p.id})` })}
                          className="inline-btn"
                          style={{ background: 'rgba(20, 184, 166, 0.16)', color: '#2dd4bf', fontSize: '0.73rem', padding: '3px 8px' }}
                        >
                          🚚 Накладная
                        </button>
                      )}
                    </div>
                  </td>

                  {/* ACTION BUTTONS ACCORDING TO ROLE & STATUS */}
                  <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      
                      {/* 1. GIP APPROVAL OF INITIAL NEED */}
                      {(p.status === 'PENDING_APPROVAL' || p.status === 'PENDING') && isGipOrManager && (
                        <>
                          {(() => {
                            const k = `pur_${p.id}_IN_PROCUREMENT`;
                            const isL = loadingKey === k;
                            const isC = confirmedKey === k;
                            return (
                              <button
                                disabled={isL}
                                onClick={() => updatePurchaseStatus(p.id, 'IN_PROCUREMENT', {}, k)}
                                className="inline-btn"
                                style={{ background: '#10b981', color: '#fff', opacity: isL ? 0.7 : 1 }}
                                title="Одобрить потребность и передать в снабжение"
                              >
                                {isL ? '⏳ Сохранение...' : isC ? '✅ Подтверждено' : '✅ В снабжение'}
                              </button>
                            );
                          })()}
                          <button
                            disabled={loadingKey === `pur_${p.id}_REJECTED`}
                            onClick={() => updatePurchaseStatus(p.id, 'REJECTED', {}, `pur_${p.id}_REJECTED`)}
                            className="inline-btn"
                            style={{ background: '#ef4444', color: '#fff' }}
                            title="Отклонить заявку"
                          >
                            {loadingKey === `pur_${p.id}_REJECTED` ? '⏳...' : '❌'}
                          </button>
                        </>
                      )}

                      {/* 2. SUPPLY ACTION: PROCESS INVOICE & MULTI-INVOICE */}
                      {(p.status === 'IN_PROCUREMENT' || p.status === 'PENDING_APPROVAL' || p.status === 'PENDING_PAYMENT_APPROVAL' || p.status === 'APPROVED') && isSupply && (
                        <>
                          <button 
                            onClick={() => openSupplyModal(p)} 
                            className="inline-btn" 
                            style={{ background: '#3b82f6', color: '#fff' }}
                            title="Внести данные поставщика, счет и сумму"
                          >
                            📝 Внести счет
                          </button>
                          {p.items && p.items.length > 0 && (
                            <button
                              onClick={() => openMultiInvoiceModal(p)}
                              className="inline-btn"
                              style={{ background: '#0ea5e9', color: '#fff' }}
                              title="Добавить отдельный счет и привязать позиции"
                            >
                              + Добавить счет на оплату
                            </button>
                          )}
                        </>
                      )}

                      {/* 3. GIP APPROVAL OF INVOICE PRICE */}
                      {p.status === 'PENDING_PAYMENT_APPROVAL' && isGipOrManager && (
                        <>
                          {(() => {
                            const k = `pur_${p.id}_APPROVED_FOR_PAYMENT`;
                            const isL = loadingKey === k;
                            const isC = confirmedKey === k;
                            return (
                              <button
                                disabled={isL}
                                onClick={() => handleApproveInvoice(p)}
                                className="inline-btn"
                                style={{ background: '#10b981', color: '#fff', opacity: isL ? 0.7 : 1 }}
                                title="Утвердить сумму счета и передать на оплату в бухгалтерию"
                              >
                                {isL ? '⏳ Сохранение...' : isC ? '✅ Подтверждено' : '✅ Утвердить к оплате'}
                              </button>
                            );
                          })()}
                          <button
                            disabled={loadingKey === `pur_${p.id}_RESUBMIT`}
                            onClick={() => updatePurchaseStatus(p.id, 'IN_PROCUREMENT', {}, `pur_${p.id}_RESUBMIT`)}
                            className="inline-btn"
                            style={{ background: '#f59e0b', color: '#fff' }}
                            title="Вернуть снабженцу на пересогласование цены"
                          >
                            {loadingKey === `pur_${p.id}_RESUBMIT` ? '⏳ Сохранение...' : '↩️ Пересогласовать'}
                          </button>
                        </>
                      )}

                      {/* 4. CHIEF ACCOUNTANT PAYMENT ACTION */}
                      {(p.status === 'APPROVED_FOR_PAYMENT' || p.status === 'APPROVED') && (
                        isChiefAccountant ? (() => {
                          const k = `pur_${p.id}_PAID_AND_ORDERED`;
                          const isL = loadingKey === k;
                          const isC = confirmedKey === k;
                          return (
                            <button
                              disabled={isL}
                              onClick={() => updatePurchaseStatus(p.id, 'PAID_AND_ORDERED', {}, k)}
                              className="inline-btn"
                              style={{ background: '#10b981', color: '#fff', fontWeight: 600, opacity: isL ? 0.7 : 1 }}
                              title="Главный бухгалтер: подтвердить оплату счета"
                            >
                              {isL ? '⏳ Сохранение...' : isC ? '✅ Подтверждено' : '💳 Подтвердить оплату'}
                            </button>
                          );
                        })() : isAccountant ? (
                          <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontStyle: 'italic', alignSelf: 'center' }}>
                            ⏳ Ждет оплаты Главбухом
                          </span>
                        ) : null
                      )}

                      {/* 4.5 ACCOUNTANT: ISSUE POA (ДОВЕРЕННОСТЬ Д-1) */}
                      {(p.status === 'PAID_AND_ORDERED' || p.status === 'PAID') && isAccountant && (
                        <button
                          onClick={() => openPoaModal(p)}
                          className="inline-btn"
                          style={{ background: '#8b5cf6', color: '#fff', fontWeight: 600 }}
                          title="Оформить доверенность формы Д-1 для получения ТМЦ"
                        >
                          📜 Внести доверенность
                        </button>
                      )}
                      {p.status === 'POA_ISSUED' && isAccountant && (
                        <button
                          onClick={() => openPoaModal(p)}
                          className="inline-btn"
                          style={{ background: 'rgba(139, 92, 246, 0.18)', color: '#c4b5fd', fontSize: '0.75rem' }}
                          title="Редактировать данные доверенности Д-1"
                        >
                          📜 Ред. Д-1
                        </button>
                      )}

                      {/* 5. EXPENSE APPROVAL & PAYMENT */}
                      {p.status === 'PENDING_EXPENSE' && isGipOrManager && (
                        <>
                          {(() => {
                            const k = `pur_${p.id}_APPROVED_EXPENSE`;
                            const isL = loadingKey === k;
                            const isC = confirmedKey === k;
                            return (
                              <button
                                disabled={isL}
                                onClick={() => updatePurchaseStatus(p.id, 'APPROVED_EXPENSE', {}, k)}
                                className="inline-btn"
                                style={{ background: '#10b981', color: '#fff', opacity: isL ? 0.7 : 1 }}
                                title="Одобрить чек подотчета"
                              >
                                {isL ? '⏳ Сохранение...' : isC ? '✅ Подтверждено' : '✅ Одобрить подотчет'}
                              </button>
                            );
                          })()}
                          <button
                            disabled={loadingKey === `pur_${p.id}_REJECTED`}
                            onClick={() => updatePurchaseStatus(p.id, 'REJECTED', {}, `pur_${p.id}_REJECTED`)}
                            className="inline-btn"
                            style={{ background: '#ef4444', color: '#fff' }}
                          >
                            {loadingKey === `pur_${p.id}_REJECTED` ? '⏳...' : '❌'}
                          </button>
                        </>
                      )}

                      {p.status === 'APPROVED_EXPENSE' && (
                        isChiefAccountant ? (() => {
                          const k = `pur_${p.id}_PAID_EXPENSE`;
                          const isL = loadingKey === k;
                          const isC = confirmedKey === k;
                          return (
                            <button
                              disabled={isL}
                              onClick={() => updatePurchaseStatus(p.id, 'PAID_EXPENSE', {}, k)}
                              className="inline-btn"
                              style={{ background: '#10b981', color: '#fff', fontWeight: 600, opacity: isL ? 0.7 : 1 }}
                              title="Главный бухгалтер: выплатить подотчет"
                            >
                              {isL ? '⏳ Сохранение...' : isC ? '✅ Подтверждено' : '💳 Выплатить'}
                            </button>
                          );
                        })() : isAccountant ? (
                          <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontStyle: 'italic', alignSelf: 'center' }}>
                            ⏳ К выплате (Главбух)
                          </span>
                        ) : null
                      )}

                      {/* 6. SUPPLY: PICKED UP AT SUPPLIER / IN TRANSIT */}
                      {(p.status === 'POA_ISSUED' || p.status === 'PAID_AND_ORDERED' || p.status === 'PAID') && (isSupply || isGipOrManager) && (() => {
                        const k = `pur_${p.id}_IN_TRANSIT`;
                        const isL = loadingKey === k;
                        const isC = confirmedKey === k;
                        return (
                          <button
                            disabled={isL}
                            onClick={() => updatePurchaseStatus(p.id, 'IN_TRANSIT', {}, k)}
                            className="inline-btn"
                            style={{ background: isC ? '#10b981' : '#3b82f6', color: '#fff', fontWeight: 600, opacity: isL ? 0.7 : 1 }}
                            title="Товар получен у поставщика / Везем на склад"
                          >
                            {isL ? '⏳ Сохранение...' : isC ? '✅ Подтверждено' : '🚚 Везем на склад'}
                          </button>
                        );
                      })()}

                      {/* 7. WAREHOUSE: RECEIVE AT WAREHOUSE WITH DELIVERY NOTE */}
                      {(p.status === 'IN_TRANSIT' || p.status === 'POA_ISSUED' || p.status === 'PAID_AND_ORDERED' || p.status === 'PAID') && (isWarehouse || isGipOrManager) && (
                        <button
                          onClick={() => {
                            setDeliveryModalPurchase(p);
                            setDeliveryNoteUrl(p.deliveryNoteUrl || '');
                          }}
                          className="inline-btn"
                          style={{ background: '#14b8a6', color: '#fff', fontWeight: 600 }}
                          title="Кладовщик проверил и принял ТМЦ на склад (с загрузкой накладной)"
                        >
                          📦 Принять на склад
                        </button>
                      )}

                      {/* 8. ADMIN / MANAGER CONTROLS */}
                      {isGipOrManager && (
                        <button onClick={() => setEditingPurchase(p)} className="inline-btn" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }} title="Редактировать заявку">
                          ✏️
                        </button>
                      )}
                      {(role === 'ADMIN' || (role === 'MANAGER' && !['PAID_AND_ORDERED', 'PAID', 'PAID_EXPENSE', 'POA_ISSUED', 'IN_TRANSIT', 'DELIVERED'].includes(p.status))) && (
                        <button onClick={() => handleDeletePurchase(p.id)} className="inline-btn" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }} title="Удалить заявку">
                          🗑️
                        </button>
                      )}

                    </div>
                  </td>

                </tr>
                {expandedPurchaseIds.includes(p.id) && (
                  <tr style={{ background: 'rgba(15, 23, 42, 0.55)', borderBottom: '1px solid var(--border-color)' }}>
                    <td colSpan={6} style={{ padding: '14px 18px' }}>
                      {/* Позиции заявки */}
                      {p.items && p.items.length > 0 && (
                        <div style={{ marginBottom: '14px' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px', color: '#93c5fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>📋 Позиции спецификации ({p.items.length})</span>
                            {isSupply && (
                              <button
                                type="button"
                                onClick={() => openMultiInvoiceModal(p)}
                                className="inline-btn"
                                style={{ background: '#0ea5e9', color: '#fff', fontSize: '0.75rem', padding: '4px 10px' }}
                              >
                                + Добавить счет на оплату
                              </button>
                            )}
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Наименование</th>
                                <th style={{ padding: '6px 8px', textAlign: 'center' }}>Кол-во</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Обеспечение</th>
                                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Действие</th>
                              </tr>
                            </thead>
                            <tbody>
                              {p.items.map((it: any) => (
                                <tr key={it.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                  <td style={{ padding: '6px 8px' }}>{it.name}</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>{it.quantity} {it.unit}</td>
                                  <td style={{ padding: '6px 8px' }}>
                                    {it.sourceType === 'FROM_STOCK' ? (
                                      <span style={{ color: '#2dd4bf', fontWeight: 600 }}>📦 Взято со склада</span>
                                    ) : it.sourceType === 'INVOICE' ? (
                                      <span style={{ color: it.isPaid ? '#10b981' : '#a78bfa', fontWeight: 600 }}>
                                        📄 По счету {it.invoice?.invoiceNumber ? `№${it.invoice.invoiceNumber}` : `#${it.invoiceId}`}
                                        {it.isPaid ? ' (💳 Оплачено)' : ' (Ожидает оплаты)'}
                                      </span>
                                    ) : (
                                      <span style={{ color: '#f59e0b' }}>⏳ Не закрыто</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                                    {it.sourceType === 'PENDING' && (isSupply || isWarehouse || isGipOrManager) && (
                                      <button
                                        type="button"
                                        disabled={loadingKey === `item_stock_${it.id}`}
                                        onClick={() => handleMarkItemFromStock(p.id, it.id)}
                                        className="inline-btn"
                                        style={{ fontSize: '0.72rem', padding: '3px 8px', background: 'rgba(20, 184, 166, 0.2)', color: '#2dd4bf' }}
                                      >
                                        {loadingKey === `item_stock_${it.id}` ? '⏳...' : '📦 Взять со склада'}
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Счета по заявке (PurchaseInvoice) */}
                      {p.invoices && p.invoices.length > 0 && (
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px', color: '#c4b5fd' }}>
                            📑 Привязанные счета на оплату ({p.invoices.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {p.invoices.map((inv: any) => (
                              <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '0.8rem' }}>
                                <div>
                                  <strong>{inv.supplierName || 'Поставщик'}</strong> {inv.invoiceNumber ? `• Счет №${inv.invoiceNumber}` : ''} — <strong>{inv.amount.toLocaleString('ru-RU')} ₸</strong>
                                  <span style={{ marginLeft: '8px', color: 'var(--text-muted)' }}>({inv.items?.length || 0} поз.)</span>
                                  {inv.fileUrl && (
                                    <a href={inv.fileUrl} target="_blank" rel="noreferrer" style={{ marginLeft: '10px', color: '#38bdf8', textDecoration: 'underline' }}>
                                      📎 Файл счета
                                    </a>
                                  )}
                                </div>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', background: inv.status === 'PAID' ? 'rgba(16,185,129,0.2)' : inv.status === 'APPROVED_FOR_PAYMENT' ? 'rgba(59,130,246,0.2)' : 'rgba(245,158,11,0.2)', color: inv.status === 'PAID' ? '#10b981' : inv.status === 'APPROVED_FOR_PAYMENT' ? '#60a5fa' : '#f59e0b' }}>
                                    {inv.status === 'PAID' ? 'ОПЛАЧЕН' : inv.status === 'APPROVED_FOR_PAYMENT' ? 'УТВЕРЖДЕН' : inv.status === 'REJECTED' ? 'ОТКЛОНЕН' : 'ЖДЕТ ДИРЕКТОРА'}
                                  </span>
                                  {inv.status === 'PENDING_APPROVAL' && isGipOrManager && (
                                    <button
                                      disabled={loadingKey === `inv_${inv.id}_APPROVE`}
                                      onClick={() => handleMultiInvoiceAction(inv.id, 'APPROVE', inv.amount)}
                                      className="inline-btn"
                                      style={{ background: '#10b981', color: '#fff', fontSize: '0.72rem', padding: '3px 8px' }}
                                    >
                                      {loadingKey === `inv_${inv.id}_APPROVE` ? '⏳...' : '✅ Утвердить'}
                                    </button>
                                  )}
                                  {inv.status === 'APPROVED_FOR_PAYMENT' && isChiefAccountant && (
                                    <button
                                      disabled={loadingKey === `inv_${inv.id}_PAY`}
                                      onClick={() => handleMultiInvoiceAction(inv.id, 'PAY', inv.amount)}
                                      className="inline-btn"
                                      style={{ background: '#10b981', color: '#fff', fontSize: '0.72rem', padding: '3px 8px' }}
                                    >
                                      {loadingKey === `inv_${inv.id}_PAY` ? '⏳...' : '💳 Подтвердить оплату'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
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
                  Счет от поставщика (файл PDF/Фото или ссылка на Google Диск)
                </label>
                {supplyInvoiceFileUrl.startsWith('data:') ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)', borderRadius: '6px', fontSize: '0.8rem', color: '#6ee7b7' }}>
                    <span>📎 {supplyInvoiceFile ? supplyInvoiceFile.name : 'Файл счета прикреплен'}</span>
                    <button
                      type="button"
                      onClick={() => { setSupplyInvoiceFileUrl(''); setSupplyInvoiceFile(null); if (supplyFileInputRef.current) supplyFileInputRef.current.value = ''; }}
                      style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.9rem' }}
                      title="Удалить файл счета"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <input 
                    className="form-input" 
                    placeholder="Ссылка на Google Drive / облако (или загрузите файл ниже)" 
                    value={supplyInvoiceFileUrl} 
                    onChange={e => setSupplyInvoiceFileUrl(e.target.value)} 
                  />
                )}
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    type="file"
                    ref={supplyFileInputRef}
                    style={{ display: 'none' }}
                    accept=".pdf,image/*,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.docx,.doc"
                    onChange={handleSupplyFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => supplyFileInputRef.current?.click()}
                    className="inline-btn"
                    style={{ fontSize: '0.75rem', padding: '5px 10px', background: 'rgba(255,255,255,0.08)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px' }}
                  >
                    📎 Загрузить файл счета (PDF / Фото)
                  </button>
                  <button
                    type="button"
                    onClick={handleParseSupplyInvoice}
                    disabled={isParsingInvoice || (!supplyInvoiceFile && (!supplyInvoiceFileUrl.trim() || supplyInvoiceFileUrl.startsWith('data:')))}
                    className="inline-btn"
                    style={{
                      fontSize: '0.75rem',
                      padding: '5px 12px',
                      background: isParsingInvoice ? '#475569' : 'linear-gradient(135deg, #7c3aed, #2563eb)',
                      color: '#fff',
                      fontWeight: 600,
                      borderRadius: '6px',
                      opacity: (!supplyInvoiceFile && (!supplyInvoiceFileUrl.trim() || supplyInvoiceFileUrl.startsWith('data:'))) ? 0.45 : 1,
                      cursor: (isParsingInvoice || (!supplyInvoiceFile && (!supplyInvoiceFileUrl.trim() || supplyInvoiceFileUrl.startsWith('data:')))) ? 'not-allowed' : 'pointer'
                    }}
                    title="Автоматически считать Поставщика, Номер, Дату и Сумму из счета через ИИ"
                  >
                    {isParsingInvoice ? '⏳ Распознаю счет...' : '✨ Распознать реквизиты (ИИ)'}
                  </button>
                </div>
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
              <select className="form-select" value={editingPurchase.discipline || 'GENERAL'} onChange={e => setEditingPurchase({...editingPurchase, discipline: e.target.value})}>
                <option value="KIP">🎛️ Направление: КИПиА</option>
                <option value="ELECTRO">⚡ Направление: Электрика</option>
                <option value="GENERAL">📦 Направление: Общее</option>
              </select>
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

      {/* POA (ДОВЕРЕННОСТЬ Д-1) MODAL */}
      {poaModalPurchase && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="form-card" style={{ width: '440px', background: '#151b26' }}>
            <h3 style={{ marginTop: 0, marginBottom: '6px' }}>📜 Доверенность Д-1 (Заявка #{poaModalPurchase.id})</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 0, marginBottom: '16px' }}>
              {poaModalPurchase.title} {poaModalPurchase.supplierName ? `— ${poaModalPurchase.supplierName}` : ''}
            </p>
            <form onSubmit={handlePoaSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Номер доверенности Д-1 *</label>
                <input
                  className="form-input"
                  placeholder="Например: 145"
                  value={poaNumber}
                  onChange={e => setPoaNumber(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Дата выдачи *</label>
                <input
                  className="form-input"
                  type="date"
                  value={poaDate}
                  onChange={e => setPoaDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>На кого выдана (ФИО снабженца / экспедитора) *</label>
                <input
                  className="form-input"
                  placeholder="ФИО получателя ТМЦ"
                  value={poaIssuedTo}
                  onChange={e => setPoaIssuedTo(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                <button
                  type="button"
                  onClick={() => setPoaIsEdo(false)}
                  className="inline-btn"
                  style={{ flex: 1, background: !poaIsEdo ? '#8b5cf6' : 'rgba(255,255,255,0.06)', color: !poaIsEdo ? '#fff' : 'var(--text-muted)' }}
                >
                  📎 Скан документа
                </button>
                <button
                  type="button"
                  onClick={() => setPoaIsEdo(true)}
                  className="inline-btn"
                  style={{ flex: 1, background: poaIsEdo ? '#0ea5e9' : 'rgba(255,255,255,0.06)', color: poaIsEdo ? '#fff' : 'var(--text-muted)' }}
                >
                  📡 Отправлено по ЭДО
                </button>
              </div>
              {!poaIsEdo && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Скан доверенности (ссылка или файл)</label>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                      className="form-input"
                      placeholder="https://..."
                      value={poaFileUrl}
                      onChange={e => setPoaFileUrl(e.target.value)}
                    />
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      style={{ maxWidth: '140px', fontSize: '0.75rem' }}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const url = await fileToCompressedDataUrl(f);
                        setPoaFileUrl(url);
                        showToast('📎 Скан доверенности сжат и прикреплен', 'info');
                      }}
                    />
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="inline-btn" onClick={() => setPoaModalPurchase(null)}>Отмена</button>
                <button type="submit" disabled={loadingKey === `poa_${poaModalPurchase.id}`} className="btn-submit" style={{ background: poaIsEdo ? '#0ea5e9' : '#8b5cf6' }}>
                  {loadingKey === `poa_${poaModalPurchase.id}` ? '⏳ Сохранение...' : poaIsEdo ? '📡 Сохранить (ЭДО)' : '📜 Выдать доверенность'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MULTI-INVOICE MODAL (+ Добавить счет на оплату) */}
      {multiInvoiceModalPurchase && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="form-card" style={{ width: '520px', maxHeight: '90vh', overflowY: 'auto', background: '#151b26' }}>
            <h3 style={{ marginTop: 0, marginBottom: '6px' }}>📑 Добавить счет на оплату (Заявка #{multiInvoiceModalPurchase.id})</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 0, marginBottom: '14px' }}>
              {multiInvoiceModalPurchase.title}
            </p>
            <form onSubmit={handleCreateMultiInvoice} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input className="form-input" placeholder="Поставщик (ТОО / ИП) *" value={multiInvSupplier} onChange={e => setMultiInvSupplier(e.target.value)} required />
              <div style={{ display: 'flex', gap: '8px' }}>
                <input className="form-input" placeholder="Номер счета" value={multiInvNumber} onChange={e => setMultiInvNumber(e.target.value)} />
                <input className="form-input" type="number" min="1" placeholder="Сумма счета (₸) *" value={multiInvAmount} onChange={e => setMultiInvAmount(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Файл счета (PDF / фото) или ссылка</label>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input className="form-input" placeholder="https://..." value={multiInvFileUrl} onChange={e => setMultiInvFileUrl(e.target.value)} />
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    style={{ maxWidth: '150px', fontSize: '0.75rem' }}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const url = await fileToCompressedDataUrl(f);
                      setMultiInvFileUrl(url);
                      showToast('📎 Файл счета сжат и прикреплен', 'info');
                    }}
                  />
                </div>
              </div>
              {multiInvoiceModalPurchase.items && multiInvoiceModalPurchase.items.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>Отметьте позиции, входящие в этот счет:</label>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {multiInvoiceModalPurchase.items.map((it: any) => {
                      const disabled = it.sourceType !== 'PENDING';
                      const checked = multiInvItemIds.includes(it.id);
                      return (
                        <label key={it.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', opacity: disabled ? 0.45 : 1 }}>
                          <input
                            type="checkbox"
                            disabled={disabled}
                            checked={checked}
                            onChange={(e) => {
                              setMultiInvItemIds((prev) =>
                                e.target.checked ? [...prev, it.id] : prev.filter((id) => id !== it.id)
                              );
                            }}
                          />
                          <span>{it.name} ({it.quantity} {it.unit})</span>
                          {disabled && <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>({it.sourceType === 'FROM_STOCK' ? 'Склад' : 'Уже в счете'})</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="inline-btn" onClick={() => setMultiInvoiceModalPurchase(null)}>Отмена</button>
                <button type="submit" disabled={loadingKey === `multi_inv_create_${multiInvoiceModalPurchase.id}`} className="btn-submit">
                  {loadingKey === `multi_inv_create_${multiInvoiceModalPurchase.id}` ? '⏳ Сохранение...' : 'Сохранить счет'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WAREHOUSE DELIVERY NOTE MODAL (Приемка на склад) */}
      {deliveryModalPurchase && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="form-card" style={{ width: '440px', background: '#151b26' }}>
            <h3 style={{ marginTop: 0, marginBottom: '6px' }}>📦 Приёмка на склад (Заявка #{deliveryModalPurchase.id})</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 0, marginBottom: '14px' }}>
              Прикрепите фото или PDF накладной при получении ТМЦ на склад.
            </p>
            <form onSubmit={handleDeliveryConfirm} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Фото / PDF накладной (авто-сжатие изображений)</label>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const url = await fileToCompressedDataUrl(f);
                    setDeliveryNoteUrl(url);
                    showToast('📎 Накладная сжата и готова к отправке', 'info');
                  }}
                />
              </div>
              <input
                className="form-input"
                placeholder="Или вставьте ссылку на накладную (опционально)"
                value={deliveryNoteUrl}
                onChange={(e) => setDeliveryNoteUrl(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="inline-btn" onClick={() => setDeliveryModalPurchase(null)}>Отмена</button>
                <button type="submit" disabled={loadingKey === `pur_${deliveryModalPurchase.id}_DELIVERED`} className="btn-submit" style={{ background: '#14b8a6' }}>
                  {loadingKey === `pur_${deliveryModalPurchase.id}_DELIVERED` ? '⏳ Сохранение...' : '📦 Подтвердить приемку'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FILE PREVIEW MODAL */}
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />

      {/* HIDDEN PRINT COMPONENT */}
      <div style={{ display: 'none' }}>
        <PrintPurchaseRequest ref={purchasePrintRef} purchase={activePurchaseForPrint} />
      </div>

    </div>
  );
}
