'use client';

import React, { useState, useEffect, useRef } from 'react';
import { formatDate } from '@/lib/formatters';
import { useReactToPrint } from 'react-to-print';
import PrintSaleInvoice from './PrintSaleInvoice';
import { 
  Plus, 
  Trash2, 
  Printer, 
  CheckCircle, 
  Clock, 
  FileText, 
  Truck, 
  Search, 
  AlertCircle,
  Building2,
  Calendar,
  DollarSign,
  UserCheck,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  Package
} from 'lucide-react';

interface SalesTabProps {
  currentUser: any;
}

interface ItemRow {
  brand: string;
  article: string;
  name: string;
  unit: string;
  quantity: number;
  price: number;
}

export default function SalesTab({ currentUser }: SalesTabProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterBrand, setFilterBrand] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'KANBAN' | 'TABLE'>('TABLE');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showShipModal, setShowShipModal] = useState<boolean>(false);
  const [selectedOrderForShip, setSelectedOrderForShip] = useState<any>(null);

  // New Deal Form State
  const [customerName, setCustomerName] = useState('');
  const [customerBin, setCustomerBin] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [dealBrand, setDealBrand] = useState('ONKA');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemRow[]>([
    { brand: 'ONKA', article: '', name: '', unit: 'шт', quantity: 1, price: 0 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ship Modal Form State (Доверенность)
  const [poaNumber, setPoaNumber] = useState('');
  const [poaDate, setPoaDate] = useState(new Date().toISOString().split('T')[0]);
  const [issuedToName, setIssuedToName] = useState('');
  const [poaFileUrl, setPoaFileUrl] = useState('');
  const [shipError, setShipError] = useState('');

  // Print Invoice State
  const invoicePrintRef = useRef<HTMLDivElement>(null);
  const [orderToPrint, setOrderToPrint] = useState<any>(null);

  const handlePrint = useReactToPrint({
    contentRef: invoicePrintRef,
    documentTitle: `Schet_Na_Oplatu_${orderToPrint?.orderNumber || 'Sale'}`
  });

  const triggerPrint = (order: any) => {
    setOrderToPrint(order);
    setTimeout(() => {
      handlePrint();
    }, 150);
  };

  const getAuthHeaders = () => {
    const pass = typeof window !== 'undefined' ? localStorage.getItem('ae_admin_password') || '' : '';
    const login = typeof window !== 'undefined' ? localStorage.getItem('ae_auth_login') || '' : '';
    return {
      'Content-Type': 'application/json',
      'x-auth-password': pass,
      'x-admin-password': pass,
      'x-auth-login': login,
    };
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sales', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch sales orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Item row operations
  const handleAddItemRow = () => {
    setItems(prev => [
      ...prev,
      { brand: dealBrand, article: '', name: '', unit: 'шт', quantity: 1, price: 0 }
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: keyof ItemRow, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const calculateFormTotal = () => {
    return items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0);
  };

  // Submit new deal
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert('Укажите наименование покупателя');
      return;
    }
    const invalidItem = items.find(it => !it.name.trim() || Number(it.price) <= 0);
    if (invalidItem) {
      alert('Заполните наименование и цену для всех позиций товара');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          customerName,
          customerBin,
          customerPhone,
          customerEmail,
          customerAddress,
          brand: dealBrand,
          notes,
          items,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || 'Ошибка при создании сделки');
        return;
      }

      const created = await res.json();
      setShowCreateModal(false);
      // Reset form
      setCustomerName('');
      setCustomerBin('');
      setCustomerPhone('');
      setCustomerEmail('');
      setCustomerAddress('');
      setNotes('');
      setItems([{ brand: 'ONKA', article: '', name: '', unit: 'шт', quantity: 1, price: 0 }]);
      fetchOrders();

      if (window.confirm(`Сделка ${created.orderNumber} успешно создана! Распечатать счет на оплату сейчас?`)) {
        triggerPrint(created);
      }
    } catch (err) {
      console.error(err);
      alert('Произошла непредвиденная ошибка');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status transitions
  const handleUpdateStatus = async (orderId: number, newStatus: string) => {
    try {
      const res = await fetch('/api/sales', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id: orderId, status: newStatus }),
      });
      if (res.ok) {
        fetchOrders();
      } else {
        const err = await res.json();
        alert(err.error || 'Ошибка при обновлении статуса');
      }
    } catch (err) {
      console.error(err);
      alert('Ошибка соединения');
    }
  };

  // Open Ship Modal
  const openShipModal = (order: any) => {
    setSelectedOrderForShip(order);
    setPoaNumber(order.powerOfAttorneyNumber || '');
    setPoaDate(order.powerOfAttorneyDate ? new Date(order.powerOfAttorneyDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setIssuedToName(order.issuedToName || '');
    setPoaFileUrl(order.powerOfAttorneyFileUrl || '');
    setShipError('');
    setShowShipModal(true);
  };

  // Submit Ship with Power of Attorney
  const handleConfirmShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poaNumber.trim() || !poaDate || !issuedToName.trim() || !poaFileUrl.trim()) {
      setShipError('Все 4 поля доверенности обязательны: Номер, Дата, ФИО получателя и ссылка/фото документа!');
      return;
    }

    try {
      const res = await fetch('/api/sales', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: selectedOrderForShip.id,
          status: 'SHIPPED',
          powerOfAttorneyNumber: poaNumber.trim(),
          powerOfAttorneyDate: poaDate,
          issuedToName: issuedToName.trim(),
          powerOfAttorneyFileUrl: poaFileUrl.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setShipError(err.error || 'Ошибка при фиксации отгрузки');
        return;
      }

      setShowShipModal(false);
      setSelectedOrderForShip(null);
      fetchOrders();
      alert('Товар успешно отгружен со склада! Данные доверенности зафиксированы в системе.');
    } catch (err) {
      console.error(err);
      setShipError('Ошибка соединения с сервером');
    }
  };

  const handleDeleteOrder = async (id: number, orderNum: string) => {
    if (!window.confirm(`Вы действительно хотите удалить заказ ${orderNum}?`)) return;
    try {
      const res = await fetch(`/api/sales?id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        fetchOrders();
      } else {
        const err = await res.json();
        alert(err.error || 'Ошибка при удалении');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Role helpers
  const canCreate = ['ADMIN', 'MANAGER', 'SUPPLY'].includes(currentUser?.role);
  const isAccountantOrAdmin = ['ADMIN', 'ACCOUNTANT'].includes(currentUser?.role);
  const isWarehouseOrAdmin = ['ADMIN', 'WAREHOUSE', 'MANAGER'].includes(currentUser?.role);

  // Filters
  const filteredOrders = orders.filter(o => {
    if (filterBrand !== 'ALL' && o.brand !== filterBrand) return false;
    if (filterStatus !== 'ALL' && o.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = o.orderNumber?.toLowerCase().includes(q);
      const matchCust = o.customerName?.toLowerCase().includes(q);
      const matchBin = o.customerBin?.toLowerCase().includes(q);
      const matchPoa = o.issuedToName?.toLowerCase().includes(q) || o.powerOfAttorneyNumber?.toLowerCase().includes(q);
      const matchItem = o.items?.some((it: any) => it.name.toLowerCase().includes(q) || it.article.toLowerCase().includes(q));
      if (!matchNum && !matchCust && !matchBin && !matchPoa && !matchItem) return false;
    }
    return true;
  });

  // Analytics Metrics
  const totalTurnover = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const countShipped = orders.filter(o => o.status === 'SHIPPED').length;
  const countPaid = orders.filter(o => o.status === 'PAID' || o.status === 'READY_FOR_PICKUP').length;
  const countPendingPayment = orders.filter(o => o.status === 'INVOICE_SENT' || o.status === 'DRAFT').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: '#64748b20', color: '#94a3b8', border: '1px solid #64748b40' }}>Черновик</span>;
      case 'INVOICE_SENT':
        return <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: '#3b82f620', color: '#60a5fa', border: '1px solid #3b82f640' }}>Счет выставлен</span>;
      case 'PAID':
        return <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: '#10b98120', color: '#34d399', border: '1px solid #10b98140' }}>Оплачен</span>;
      case 'READY_FOR_PICKUP':
        return <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: '#f59e0b20', color: '#fbbf24', border: '1px solid #f59e0b40' }}>Готов к отгрузке</span>;
      case 'SHIPPED':
        return <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: '#8b5cf620', color: '#a78bfa', border: '1px solid #8b5cf640' }}>Отгружен (Закрыт)</span>;
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', width: '100%' }}>
      
      {/* 1. Header & Quick Analytics */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            ⚡ Продажи электрооборудования
            <span style={{ fontSize: '0.85rem', padding: '3px 10px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
              ONKA / WEG
            </span>
          </h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Выставление официальных счетов на оплату РК и контроль отгрузки по доверенности покупателя
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-submit"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: 'var(--accent-orange)', color: '#000', fontWeight: 700, margin: 0 }}
          >
            <Plus size={18} />
            Новая сделка / Выставить счет
          </button>
        )}
      </div>

      {/* 2. Статистические карточки */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Общий объем продаж</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#38bdf8' }}>{totalTurnover.toLocaleString('ru-RU')} ₸</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ожидают оплаты</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fbbf24' }}>{countPendingPayment} счетов</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <Package size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Оплачено (В подготовке)</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#34d399' }}>{countPaid} заказов</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
            <Truck size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Отгружено по доверенности</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#a78bfa' }}>{countShipped} закрыто</div>
          </div>
        </div>
      </div>

      {/* 3. Фильтры и поиск */}
      <div className="card" style={{ padding: '14px 18px', display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
          
          {/* Поиск */}
          <div style={{ position: 'relative', minWidth: '220px', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Поиск по номеру счета, клиенту, БИН, товару..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '34px', fontSize: '0.85rem' }}
            />
          </div>

          {/* Фильтр по бренду */}
          <select
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            className="form-select"
            style={{ width: '140px', fontSize: '0.85rem' }}
          >
            <option value="ALL">Все бренды</option>
            <option value="ONKA">ONKA</option>
            <option value="WEG">WEG</option>
            <option value="MIXED">Смешанный</option>
          </select>

          {/* Фильтр по статусу */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="form-select"
            style={{ width: '170px', fontSize: '0.85rem' }}
          >
            <option value="ALL">Все статусы</option>
            <option value="DRAFT">Черновики</option>
            <option value="INVOICE_SENT">Счет выставлен</option>
            <option value="PAID">Оплачено</option>
            <option value="READY_FOR_PICKUP">Готов к отгрузке</option>
            <option value="SHIPPED">Отгружен</option>
          </select>
        </div>

        {/* Переключатель вида Таблица / Канбан */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setViewMode('TABLE')}
            className={`inline-btn ${viewMode === 'TABLE' ? 'active' : ''}`}
            style={{ background: viewMode === 'TABLE' ? 'var(--accent-orange)' : 'rgba(255,255,255,0.05)', color: viewMode === 'TABLE' ? '#000' : 'var(--text-main)', padding: '6px 12px' }}
          >
            Таблица
          </button>
          <button
            onClick={() => setViewMode('KANBAN')}
            className={`inline-btn ${viewMode === 'KANBAN' ? 'active' : ''}`}
            style={{ background: viewMode === 'KANBAN' ? 'var(--accent-orange)' : 'rgba(255,255,255,0.05)', color: viewMode === 'KANBAN' ? '#000' : 'var(--text-main)', padding: '6px 12px' }}
          >
            Канбан
          </button>
        </div>
      </div>

      {/* 4. Табличный вид */}
      {viewMode === 'TABLE' && (
        <div className="card" style={{ padding: '0', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '12px 16px' }}>Счет / Дата</th>
                <th style={{ padding: '12px 16px' }}>Покупатель / БИН</th>
                <th style={{ padding: '12px 16px' }}>Бренд</th>
                <th style={{ padding: '12px 16px' }}>Товары (позиций)</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Сумма (₸)</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Статус</th>
                <th style={{ padding: '12px 16px' }}>Доверенность / Получатель</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Загрузка сделок...</td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Сделок не найдено. Нажмите «Новая сделка», чтобы выставить первый счет.</td>
                </tr>
              ) : (
                filteredOrders.map(order => (
                  <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--accent-orange)' }}>{order.orderNumber}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(order.invoiceDate || order.createdAt)}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{order.customerName}</div>
                      {order.customerBin && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>БИН: {order.customerBin}</div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: order.brand === 'ONKA' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: order.brand === 'ONKA' ? '#60a5fa' : '#34d399',
                        border: `1px solid ${order.brand === 'ONKA' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                      }}>
                        {order.brand}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 500 }}>{order.items?.length || 0} поз.</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {order.items?.map((it: any) => `${it.article} ${it.name}`).join(', ') || '-'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{Number(order.totalAmount).toLocaleString('ru-RU')} ₸</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>в т.ч. НДС {Number(order.vatAmount).toLocaleString('ru-RU')} ₸</div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {getStatusBadge(order.status)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {order.status === 'SHIPPED' ? (
                        <div style={{ fontSize: '0.8rem' }}>
                          <div style={{ fontWeight: 600, color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <ShieldCheck size={14} /> Доверенность {order.powerOfAttorneyNumber}
                          </div>
                          <div style={{ color: 'var(--text-muted)' }}>от {order.powerOfAttorneyDate ? formatDate(order.powerOfAttorneyDate) : '-'}</div>
                          <div style={{ color: 'var(--text-main)' }}>Выдана: {order.issuedToName}</div>
                          {order.powerOfAttorneyFileUrl && (
                            <a href={order.powerOfAttorneyFileUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                              <ExternalLink size={12} /> Скан документа
                            </a>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          {order.status === 'READY_FOR_PICKUP' ? 'Ожидается доверенность' : '—'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {/* Печать счета */}
                        <button
                          onClick={() => triggerPrint(order)}
                          className="inline-btn"
                          title="Распечатать / Скачать Счет на оплату (PDF)"
                          style={{ padding: '6px 10px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', borderColor: 'rgba(59, 130, 246, 0.3)' }}
                        >
                          <Printer size={14} />
                        </button>

                        {/* Действие 1: Отправить счет */}
                        {order.status === 'DRAFT' && canCreate && (
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'INVOICE_SENT')}
                            className="inline-btn"
                            style={{ padding: '6px 10px', background: '#3b82f6', color: '#fff' }}
                          >
                            Выставить счет
                          </button>
                        )}

                        {/* Действие 2: Подтвердить оплату (Бухгалтер / Директор) */}
                        {order.status === 'INVOICE_SENT' && isAccountantOrAdmin && (
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'PAID')}
                            className="inline-btn"
                            style={{ padding: '6px 10px', background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <CheckCircle size={14} /> Подтвердить оплату
                          </button>
                        )}

                        {/* Действие 3: Подготовка на складе (Кладовщик) */}
                        {order.status === 'PAID' && isWarehouseOrAdmin && (
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'READY_FOR_PICKUP')}
                            className="inline-btn"
                            style={{ padding: '6px 10px', background: '#f59e0b', color: '#000', fontWeight: 600 }}
                          >
                            Готов к отгрузке
                          </button>
                        )}

                        {/* Действие 4: Выдать со склада по доверенности (Кладовщик) */}
                        {order.status === 'READY_FOR_PICKUP' && isWarehouseOrAdmin && (
                          <button
                            onClick={() => openShipModal(order)}
                            className="inline-btn"
                            style={{ padding: '6px 10px', background: '#8b5cf6', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Truck size={14} /> Выдать по доверенности
                          </button>
                        )}

                        {/* Удаление черновика */}
                        {(order.status === 'DRAFT' || currentUser?.role === 'ADMIN') && (
                          <button
                            onClick={() => handleDeleteOrder(order.id, order.orderNumber)}
                            className="inline-btn"
                            style={{ padding: '6px 8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                            title="Удалить сделку"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. Канбан-вид */}
      {viewMode === 'KANBAN' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '15px', alignItems: 'start' }}>
          {[
            { id: 'DRAFT', title: 'Черновик', color: '#94a3b8' },
            { id: 'INVOICE_SENT', title: 'Счет выставлен', color: '#60a5fa' },
            { id: 'PAID', title: 'Оплачен (В цеху)', color: '#34d399' },
            { id: 'READY_FOR_PICKUP', title: 'Готов к выдаче', color: '#fbbf24' },
            { id: 'SHIPPED', title: 'Отгружен (Закрыт)', color: '#a78bfa' },
          ].map(col => {
            const colOrders = filteredOrders.filter(o => o.status === col.id);
            return (
              <div key={col.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2px solid ${col.color}`, paddingBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: col.color }}>{col.title}</span>
                  <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '10px' }}>
                    {colOrders.length}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '100px' }}>
                  {colOrders.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '20px 0' }}>Пусто</div>
                  ) : (
                    colOrders.map(order => (
                      <div key={order.id} style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontWeight: 700, color: 'var(--accent-orange)', fontSize: '0.88rem' }}>{order.orderNumber}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(order.invoiceDate || order.createdAt)}</span>
                        </div>

                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{order.customerName}</div>
                        {order.customerBin && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>БИН: {order.customerBin}</div>}

                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {order.items?.length || 0} поз. ({order.brand})
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#38bdf8' }}>
                            {Number(order.totalAmount).toLocaleString('ru-RU')} ₸
                          </div>
                          <button
                            onClick={() => triggerPrint(order)}
                            className="inline-btn"
                            title="Печать счета"
                            style={{ padding: '4px 8px' }}
                          >
                            <Printer size={13} />
                          </button>
                        </div>

                        {/* Кнопки перевода статуса в карточке канбана */}
                        <div style={{ marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                          {order.status === 'DRAFT' && canCreate && (
                            <button onClick={() => handleUpdateStatus(order.id, 'INVOICE_SENT')} className="btn-submit" style={{ width: '100%', padding: '6px', fontSize: '0.8rem', margin: 0 }}>
                              Выставить счет
                            </button>
                          )}
                          {order.status === 'INVOICE_SENT' && isAccountantOrAdmin && (
                            <button onClick={() => handleUpdateStatus(order.id, 'PAID')} className="btn-submit" style={{ width: '100%', padding: '6px', fontSize: '0.8rem', background: '#10b981', margin: 0 }}>
                              Подтвердить оплату
                            </button>
                          )}
                          {order.status === 'PAID' && isWarehouseOrAdmin && (
                            <button onClick={() => handleUpdateStatus(order.id, 'READY_FOR_PICKUP')} className="btn-submit" style={{ width: '100%', padding: '6px', fontSize: '0.8rem', background: '#f59e0b', color: '#000', margin: 0 }}>
                              Готов к отгрузке
                            </button>
                          )}
                          {order.status === 'READY_FOR_PICKUP' && isWarehouseOrAdmin && (
                            <button onClick={() => openShipModal(order)} className="btn-submit" style={{ width: '100%', padding: '6px', fontSize: '0.8rem', background: '#8b5cf6', margin: 0 }}>
                              🚚 Выдать по доверенности
                            </button>
                          )}
                          {order.status === 'SHIPPED' && (
                            <div style={{ fontSize: '0.75rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <ShieldCheck size={14} /> Довер. {order.powerOfAttorneyNumber} ({order.issuedToName})
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. МОДАЛЬНОЕ ОКНО СОЗДАНИЯ СДЕЛКИ (НОВЫЙ СЧЕТ НА ОПЛАТУ) */}
      {/* ======================================================== */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '850px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                📄 Новая сделка / Счет на оплату оборудования
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="inline-btn" style={{ padding: '4px 10px' }}>✕</button>
            </div>

            <form onSubmit={handleCreateOrder} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* Реквизиты покупателя */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--accent-orange)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Building2 size={16} /> Реквизиты покупателя
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Наименование компании / ФИО *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="ТОО «ПромЭлектроМонтаж»"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>БИН / ИИН</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="12 цифр (например 210440012345)"
                      value={customerBin}
                      onChange={(e) => setCustomerBin(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Телефон</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="+7 (701) 000-00-00"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Email для счетов</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="buh@company.kz"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-group" style={{ marginTop: '12px', marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Юридический / фактический адрес</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="г. Алматы, пр. Аль-Фараби 77/7"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                  />
                </div>
              </div>

              {/* Выбор линейки оборудования */}
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <label className="form-label" style={{ marginBottom: 0, fontSize: '0.85rem' }}>Линейка оборудования:</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {['ONKA', 'WEG', 'MIXED'].map(b => (
                    <label key={b} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                      <input
                        type="radio"
                        name="dealBrand"
                        checked={dealBrand === b}
                        onChange={() => setDealBrand(b)}
                      />
                      {b === 'MIXED' ? 'Смешанный (ONKA + WEG)' : b}
                    </label>
                  ))}
                </div>
              </div>

              {/* Табличная часть с позициями */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--accent-orange)' }}>
                    📦 Спецификация оборудования
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="inline-btn"
                    style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', borderColor: 'rgba(59, 130, 246, 0.4)', padding: '4px 10px', fontSize: '0.8rem' }}
                  >
                    + Добавить позицию
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {items.map((item, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '90px 110px 1fr 65px 65px 100px 30px', gap: '8px', alignItems: 'center' }}>
                      <select
                        className="form-select"
                        value={item.brand}
                        onChange={(e) => handleItemChange(idx, 'brand', e.target.value)}
                        style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                      >
                        <option value="ONKA">ONKA</option>
                        <option value="WEG">WEG</option>
                        <option value="ПРОЧЕЕ">Другое</option>
                      </select>

                      <input
                        type="text"
                        placeholder="Артикул"
                        className="form-input"
                        value={item.article}
                        onChange={(e) => handleItemChange(idx, 'article', e.target.value)}
                        style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                      />

                      <input
                        type="text"
                        placeholder="Наименование (Клемма, автомат, реле, привод...)"
                        className="form-input"
                        value={item.name}
                        onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                        required
                        style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                      />

                      <input
                        type="number"
                        placeholder="Кол-во"
                        min="1"
                        className="form-input"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value))}
                        style={{ padding: '6px 4px', fontSize: '0.8rem', textAlign: 'center' }}
                      />

                      <input
                        type="text"
                        placeholder="Ед."
                        className="form-input"
                        value={item.unit}
                        onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                        style={{ padding: '6px 4px', fontSize: '0.8rem', textAlign: 'center' }}
                      />

                      <input
                        type="number"
                        placeholder="Цена с НДС"
                        min="0"
                        className="form-input"
                        value={item.price || ''}
                        onChange={(e) => handleItemChange(idx, 'price', Number(e.target.value))}
                        style={{ padding: '6px 8px', fontSize: '0.8rem', textAlign: 'right' }}
                      />

                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        disabled={items.length <= 1}
                        style={{ background: 'none', border: 'none', color: items.length <= 1 ? '#475569' : '#ef4444', cursor: items.length <= 1 ? 'not-allowed' : 'pointer', padding: 0 }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Предварительный расчет */}
                <div style={{ marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px', textAlign: 'right', fontSize: '0.9rem' }}>
                  <div style={{ color: 'var(--text-muted)' }}>В т.ч. НДС (16%): {Math.round((calculateFormTotal() * 16) / 116).toLocaleString('ru-RU')} ₸</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent-orange)', marginTop: '4px' }}>
                    Итого к оплате: {calculateFormTotal().toLocaleString('ru-RU')} ₸
                  </div>
                </div>
              </div>

              {/* Примечание */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Примечание к заказу (условия доставки, резерв):</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Резерв на складе до 5 банковских дней..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="inline-btn"
                  style={{ padding: '8px 16px' }}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-submit"
                  style={{ padding: '8px 22px', background: 'var(--accent-orange)', color: '#000', fontWeight: 700, margin: 0 }}
                >
                  {isSubmitting ? 'Создание...' : 'Сформировать счет на оплату'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. МОДАЛЬНОЕ ОКНО ФИКСАЦИИ ОТГРУЗКИ ПО ДОВЕРЕННОСТИ       */}
      {/* ======================================================== */}
      {showShipModal && selectedOrderForShip && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '550px', width: '95%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Truck size={20} color="#8b5cf6" />
                Отгрузка товара со склада (Статус SHIPPED)
              </h3>
              <button onClick={() => setShowShipModal(false)} className="inline-btn" style={{ padding: '4px 10px' }}>✕</button>
            </div>

            <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.3)', marginBottom: '15px', fontSize: '0.85rem' }}>
              <strong>Заказ {selectedOrderForShip.orderNumber}</strong> на сумму <strong>{Number(selectedOrderForShip.totalAmount).toLocaleString('ru-RU')} ₸</strong><br />
              Покупатель: <strong>{selectedOrderForShip.customerName}</strong>
            </div>

            <div style={{ fontSize: '0.85rem', color: '#fca5a5', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={16} />
              Согласно законодательству РК, отпуск товара со склада без доверенности строго запрещен.
            </div>

            {shipError && (
              <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '15px' }}>
                {shipError}
              </div>
            )}

            <form onSubmit={handleConfirmShipment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Номер доверенности *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="№ 142/Д"
                  value={poaNumber}
                  onChange={(e) => setPoaNumber(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Дата выдачи доверенности *</label>
                <input
                  type="date"
                  className="form-input"
                  value={poaDate}
                  onChange={(e) => setPoaDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>ФИО доверенного лица (Получателя) *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Иванов Иван Иванович (по удостоверению)"
                  value={issuedToName}
                  onChange={(e) => setIssuedToName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Скан / Фото оригинала доверенности (URL или ссылка в Telegram) *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="https://... или ссылка на фото"
                  value={poaFileUrl}
                  onChange={(e) => setPoaFileUrl(e.target.value)}
                  required
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px', display: 'block' }}>
                  Прикрепите ссылку на фото документа или скан из Telegram-бота.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowShipModal(false)}
                  className="inline-btn"
                  style={{ padding: '8px 16px' }}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  style={{ padding: '8px 22px', background: '#8b5cf6', color: '#fff', fontWeight: 700, margin: 0 }}
                >
                  Подтвердить отгрузку и закрыть сделку
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Невидимый компонент для генерации и печати официального счета */}
      <div style={{ display: 'none' }}>
        <PrintSaleInvoice ref={invoicePrintRef} order={orderToPrint} />
      </div>

    </div>
  );
}
