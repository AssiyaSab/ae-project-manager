'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useToast } from './ToastProvider';

interface ProjectEstimateModalProps {
  project: { id: number; name: string };
  onClose: () => void;
}

export default function ProjectEstimateModal({ project, onClose }: ProjectEstimateModalProps) {
  const { showToast } = useToast();
  const [estimateItems, setEstimateItems] = useState<any[]>([]);
  const [unlinkedPurchaseItems, setUnlinkedPurchaseItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'CLOSED_PURCHASE' | 'CLOSED_STOCK' | 'REPLACED'>('ALL');
  const [googleUrl, setGoogleUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add manual item state
  const [showAddRow, setShowAddRow] = useState(false);
  const [newName, setNewName] = useState('');
  const [newArticle, setNewArticle] = useState('');
  const [newUnit, setNewUnit] = useState('шт');
  const [newQty, setNewQty] = useState('1');
  const [newPrice, setNewPrice] = useState('0');

  // Link / Replacement modal state
  const [linkEstItem, setLinkEstItem] = useState<any>(null);
  const [selectedPurchaseItemId, setSelectedPurchaseItemId] = useState('');
  const [isReplacement, setIsReplacement] = useState(false);
  const [replacementNote, setReplacementNote] = useState('');

  const getAuthHeaders = () => {
    const pass = typeof window !== 'undefined' ? localStorage.getItem('ae_admin_password') || '' : '';
    const login = typeof window !== 'undefined' ? localStorage.getItem('ae_auth_login') || '' : '';
    return {
      'x-admin-password': pass,
      'x-auth-password': pass,
      'x-auth-login': login,
    };
  };

  const fetchEstimate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/estimate`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setEstimateItems(data.estimateItems || []);
        setUnlinkedPurchaseItems(data.unlinkedPurchaseItems || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEstimate();
  }, [project.id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/projects/${project.id}/estimate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Ошибка импорта сметы', 'error');
        return;
      }
      showToast(`✅ Импортировано позиций: ${data.importedCount}`, 'success');
      fetchEstimate();
    } catch {
      showToast('Ошибка сети при импорте файла', 'error');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGoogleImport = async () => {
    if (!googleUrl.trim()) return;
    setIsImporting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/estimate`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleDriveUrl: googleUrl.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Ошибка импорта Google Таблицы', 'error');
        return;
      }
      showToast(`✅ Импортировано позиций: ${data.importedCount}`, 'success');
      setGoogleUrl('');
      fetchEstimate();
    } catch {
      showToast('Ошибка сети при импорте Google Таблицы', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleAddManualItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const res = await fetch(`/api/projects/${project.id}/estimate`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD_ITEM',
          name: newName,
          article: newArticle,
          unit: newUnit,
          plannedQty: Number(newQty) || 1,
          plannedPrice: Number(newPrice) || 0,
        }),
      });
      if (res.ok) {
        showToast('✅ Позиция добавлена в смету', 'success');
        setNewName('');
        setNewArticle('');
        setNewQty('1');
        setNewPrice('0');
        setShowAddRow(false);
        fetchEstimate();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReconcileNow = async () => {
    try {
      await fetch(`/api/projects/${project.id}/estimate`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RECONCILE' }),
      });
      showToast('🔄 Сверка сметы выполнена', 'success');
      fetchEstimate();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLinkOrReplaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkEstItem) return;
    try {
      const res = await fetch(`/api/projects/${project.id}/estimate`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'LINK_OR_REPLACE',
          estimateItemId: linkEstItem.id,
          purchaseItemId: selectedPurchaseItemId ? Number(selectedPurchaseItemId) : undefined,
          isReplacement,
          replacementNote: replacementNote.trim() || undefined,
        }),
      });
      if (res.ok) {
        showToast(isReplacement ? '🔄 Замена аналогом оформлена' : '🔗 Позиция сопоставлена', 'success');
        setLinkEstItem(null);
        fetchEstimate();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteEstimateItem = async (itemId: number) => {
    if (!window.confirm('Удалить позицию из сметы?')) return;
    await fetch(`/api/projects/${project.id}/estimate?itemId=${itemId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    fetchEstimate();
  };

  const handleExportExcel = () => {
    const statusLabels: Record<string, string> = {
      OPEN: 'Осталось закупить',
      CLOSED_PURCHASE: 'Закрыто (Закупка)',
      CLOSED_STOCK: 'Взято со склада',
      REPLACED: 'Заменено аналогом',
      PARTIAL: 'Частично закрыто',
    };
    const rows = estimateItems.map((it, idx) => ({
      '№': idx + 1,
      'Наименование': it.name,
      'Артикул': it.article || '',
      'Ед. изм.': it.unit,
      'План (кол-во)': it.plannedQty,
      'План (цена ₸)': it.plannedPrice,
      'План (сумма ₸)': it.plannedTotal,
      'Факт (кол-во)': it.actualQty,
      'Факт (сумма ₸)': it.actualTotal,
      'Отклонение (₸)': (it.plannedTotal || 0) - (it.actualTotal || 0),
      'Статус': statusLabels[it.status] || it.status,
      'Примечание / Замена': it.replacementNote || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Сверка сметы');
    XLSX.writeFile(wb, `Smeta_Sverka_Project_${project.id}.xlsx`);
  };

  // Summary KPIs
  const plannedBudget = estimateItems.reduce((s, it) => s + (Number(it.plannedTotal) || 0), 0);
  const actualCost = estimateItems.reduce((s, it) => s + (Number(it.actualTotal) || 0), 0);
  const diff = plannedBudget - actualCost;

  const totalCount = estimateItems.length;
  const closedPurchaseCount = estimateItems.filter((it) => it.status === 'CLOSED_PURCHASE').length;
  const closedStockCount = estimateItems.filter((it) => it.status === 'CLOSED_STOCK').length;
  const replacedCount = estimateItems.filter((it) => it.status === 'REPLACED').length;
  const openCount = estimateItems.filter((it) => it.status === 'OPEN' || it.status === 'PARTIAL').length;
  const closedAll = closedPurchaseCount + closedStockCount + replacedCount;
  const pct = totalCount > 0 ? Math.round((closedAll / totalCount) * 100) : 0;

  const filteredItems = estimateItems.filter((it) => {
    if (filter === 'ALL') return true;
    if (filter === 'OPEN') return it.status === 'OPEN' || it.status === 'PARTIAL';
    return it.status === filter;
  });

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' }}>
      <div className="form-card" style={{ width: '1100px', maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>📊 Смета и комплектация: {project.name}</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Загрузка сметы оборудования (Excel / PDF / Google Таблица) и сверка План vs Факт
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" onClick={handleReconcileNow} className="inline-btn" style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa' }}>
              🔄 Авто-сверка
            </button>
            <button type="button" onClick={handleExportExcel} disabled={estimateItems.length === 0} className="inline-btn" style={{ background: '#10b981', color: '#fff', fontWeight: 600 }}>
              📥 Выгрузить сверку в Excel
            </button>
            <button type="button" onClick={onClose} className="inline-btn" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
              ✕ Закрыть
            </button>
          </div>
        </div>

        {/* Верхняя сводка */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Бюджет по смете (План)</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#38bdf8' }}>{plannedBudget.toLocaleString('ru-RU')} ₸</div>
          </div>
          <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Фактические затраты</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#a78bfa' }}>{actualCost.toLocaleString('ru-RU')} ₸</div>
          </div>
          <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{diff >= 0 ? 'Экономия / Остаток' : 'Перерасход'}</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: diff >= 0 ? '#10b981' : '#ef4444' }}>
              {diff >= 0 ? '+' : ''}{diff.toLocaleString('ru-RU')} ₸
            </div>
          </div>
          <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Комплектация: {pct}% ({closedAll}/{totalCount})</div>
            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginTop: '6px', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: '#10b981' }} />
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Закупка: {closedPurchaseCount} • Склад: {closedStockCount} • Замены: {replacedCount} • Осталось: {openCount}
            </div>
          </div>
        </div>

        {/* Импорт сметы */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '14px' }}>
          <input type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv,.pdf" style={{ display: 'none' }} onChange={handleFileUpload} />
          <button
            type="button"
            disabled={isImporting}
            onClick={() => fileInputRef.current?.click()}
            className="inline-btn"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', color: '#fff', fontWeight: 600 }}
          >
            {isImporting ? '⏳ Импорт и ИИ-распознавание...' : '📂 Загрузить смету (Excel / CSV / PDF)'}
          </button>

          <div style={{ display: 'flex', gap: '6px', flex: '1 1 280px' }}>
            <input
              className="form-input"
              placeholder="Или ссылка на Google Таблицу..."
              value={googleUrl}
              onChange={(e) => setGoogleUrl(e.target.value)}
            />
            <button type="button" disabled={isImporting || !googleUrl.trim()} onClick={handleGoogleImport} className="inline-btn" style={{ background: '#0ea5e9', color: '#fff' }}>
              Импорт
            </button>
          </div>

          <button type="button" onClick={() => setShowAddRow((v) => !v)} className="inline-btn" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}>
            ➕ Добавить строку
          </button>
        </div>

        {showAddRow && (
          <form onSubmit={handleAddManualItem} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px', padding: '10px', background: 'rgba(59,130,246,0.08)', borderRadius: '8px' }}>
            <input className="form-input" placeholder="Наименование *" value={newName} onChange={(e) => setNewName(e.target.value)} required style={{ flex: '2 1 200px' }} />
            <input className="form-input" placeholder="Артикул" value={newArticle} onChange={(e) => setNewArticle(e.target.value)} style={{ flex: '1 1 120px' }} />
            <input className="form-input" placeholder="Ед." value={newUnit} onChange={(e) => setNewUnit(e.target.value)} style={{ width: '70px' }} />
            <input className="form-input" type="number" step="0.01" placeholder="Кол-во" value={newQty} onChange={(e) => setNewQty(e.target.value)} style={{ width: '90px' }} />
            <input className="form-input" type="number" step="0.01" placeholder="Цена ₸" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} style={{ width: '110px' }} />
            <button type="submit" className="btn-submit" style={{ margin: 0 }}>Сохранить</button>
          </form>
        )}

        {/* Фильтры */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {[
            { key: 'ALL', label: `Все позиции (${totalCount})` },
            { key: 'OPEN', label: `⏳ Осталось закупить (${openCount})` },
            { key: 'CLOSED_PURCHASE', label: `✅ Закрыто (Закупка: ${closedPurchaseCount})` },
            { key: 'CLOSED_STOCK', label: `📦 Взято со склада (${closedStockCount})` },
            { key: 'REPLACED', label: `🔄 Замены (${replacedCount})` },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key as any)}
              className="inline-btn"
              style={{
                background: filter === f.key ? '#2563eb' : 'rgba(255,255,255,0.06)',
                color: filter === f.key ? '#fff' : 'var(--text-muted)',
                fontWeight: filter === f.key ? 700 : 500,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Таблица сверки */}
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Загрузка сметы...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.14)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Наименование / Артикул</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>План</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>План сумма</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Факт</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Факт сумма</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Статус</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((it) => (
                  <tr key={it.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: '8px' }}>
                      <div style={{ fontWeight: 600 }}>{it.name}</div>
                      {it.article && <div style={{ fontSize: '0.73rem', color: '#38bdf8' }}>Арт.: {it.article}</div>}
                      {it.replacementNote && <div style={{ fontSize: '0.73rem', color: '#fbbf24' }}>🔄 Замена: {it.replacementNote}</div>}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>{it.plannedQty} {it.unit}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{(it.plannedTotal || 0).toLocaleString('ru-RU')} ₸</td>
                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>{it.actualQty || 0} {it.unit}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>{(it.actualTotal || 0).toLocaleString('ru-RU')} ₸</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background:
                          it.status === 'CLOSED_PURCHASE' ? 'rgba(16,185,129,0.2)' :
                          it.status === 'CLOSED_STOCK' ? 'rgba(20,184,166,0.2)' :
                          it.status === 'REPLACED' ? 'rgba(245,158,11,0.2)' :
                          it.status === 'PARTIAL' ? 'rgba(59,130,246,0.2)' :
                          'rgba(239,68,68,0.18)',
                        color:
                          it.status === 'CLOSED_PURCHASE' ? '#34d399' :
                          it.status === 'CLOSED_STOCK' ? '#2dd4bf' :
                          it.status === 'REPLACED' ? '#fbbf24' :
                          it.status === 'PARTIAL' ? '#60a5fa' :
                          '#f87171',
                      }}>
                        {it.status === 'CLOSED_PURCHASE' ? '✅ Закуплено' :
                         it.status === 'CLOSED_STOCK' ? '📦 Со склада' :
                         it.status === 'REPLACED' ? '🔄 Заменено' :
                         it.status === 'PARTIAL' ? '⏳ Частично' :
                         '⏳ Осталось'}
                      </span>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setLinkEstItem(it);
                          setSelectedPurchaseItemId('');
                          setIsReplacement(it.status === 'REPLACED');
                          setReplacementNote(it.replacementNote || '');
                        }}
                        className="inline-btn"
                        style={{ background: 'rgba(139,92,246,0.2)', color: '#c4b5fd', fontSize: '0.73rem', marginRight: '4px' }}
                      >
                        🔗 Сопоставить / Замена
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEstimateItem(it.id)}
                        className="inline-btn"
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', fontSize: '0.73rem' }}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Позиции не найдены. Загрузите смету (Excel / PDF / Google Таблица) или добавьте строку вручную.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Модалка сопоставления / замены */}
        {linkEstItem && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
            <div className="form-card" style={{ width: '480px', background: '#1e293b' }}>
              <h3 style={{ marginTop: 0, marginBottom: '8px' }}>🔗 Сопоставить / Оформить замену</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 0 }}>
                Позиция сметы: <strong>{linkEstItem.name}</strong> ({linkEstItem.plannedQty} {linkEstItem.unit})
              </p>
              <form onSubmit={handleLinkOrReplaceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Привязать позицию из закупок/накладных проекта (опционально)
                  </label>
                  <select className="form-select" value={selectedPurchaseItemId} onChange={(e) => setSelectedPurchaseItemId(e.target.value)}>
                    <option value="">-- Выберите непривязанную позицию --</option>
                    {unlinkedPurchaseItems.map((pi: any) => (
                      <option key={pi.id} value={pi.id}>
                        {pi.name} ({pi.quantity} {pi.unit}) — Заявка #{pi.purchaseId}
                      </option>
                    ))}
                  </select>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={isReplacement} onChange={(e) => setIsReplacement(e.target.checked)} />
                  🔄 Отметить как «Заменено аналогом»
                </label>

                {isReplacement && (
                  <input
                    className="form-input"
                    placeholder="На что заменено и причина замены..."
                    value={replacementNote}
                    onChange={(e) => setReplacementNote(e.target.value)}
                    required
                  />
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button type="button" className="inline-btn" onClick={() => setLinkEstItem(null)}>Отмена</button>
                  <button type="submit" className="btn-submit">Сохранить</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
