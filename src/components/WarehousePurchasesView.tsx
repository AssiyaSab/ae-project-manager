'use client';

import React, { useState } from 'react';
import { formatDate } from '@/lib/formatters';
import { uploadFileCompressed } from '@/lib/imageCompression';
import { useToast } from './ToastProvider';
import FilePreviewModal, { formatTelegramOrFileUrl } from './FilePreviewModal';

interface WarehousePurchasesViewProps {
  purchases: any[];
  getAuthHeaders: () => Record<string, string>;
  onRefresh: () => void;
}

export default function WarehousePurchasesView({
  purchases,
  getAuthHeaders,
  onRefresh,
}: WarehousePurchasesViewProps) {
  const { showToast } = useToast();
  const [subTab, setSubTab] = useState<'EXPECTED' | 'RECEIVED'>('EXPECTED');
  const [collapsedProjectKeys, setCollapsedProjectKeys] = useState<string[]>([]);
  const [previewFile, setPreviewFile] = useState<{ url: string; title: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Reception modal state
  const [receivingPurchase, setReceivingPurchase] = useState<any>(null);
  const [waybillNumber, setWaybillNumber] = useState('');
  const [waybillFileUrl, setWaybillFileUrl] = useState('');
  const [itemQuantities, setItemQuantities] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const matchesSearch = (p: any) => {
    if (!normalizedSearch) return true;
    const haystack = [
      `#${p.id}`,
      String(p.id),
      p.title,
      p.project?.name,
      p.requester?.name,
      ...(p.items || []).flatMap((it: any) => [it.name, it.sku]),
      ...(p.waybills || []).map((wb: any) => wb.waybillNumber),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedSearch);
  };

  const expectedPurchases = purchases.filter(
    (p) => ['IN_TRANSIT', 'PARTIALLY_DELIVERED'].includes(p.status) && matchesSearch(p)
  );
  const receivedPurchases = purchases.filter(
    (p) => p.status === 'DELIVERED' && matchesSearch(p)
  );

  // Group expected purchases by Project
  const projectGroupsMap = new Map<string, { key: string; projectName: string; isNoProject: boolean; purchases: any[] }>();
  for (const p of expectedPurchases) {
    const key = p.projectId ? `proj_${p.projectId}` : 'no_project';
    const existing = projectGroupsMap.get(key) || {
      key,
      projectName: p.project?.name || 'Без привязки к проекту / Складской запас',
      isNoProject: !p.projectId,
      purchases: [] as any[],
    };
    existing.purchases.push(p);
    projectGroupsMap.set(key, existing);
  }
  const projectGroups = Array.from(projectGroupsMap.values()).sort((a, b) => {
    if (a.isNoProject && !b.isNoProject) return 1;
    if (!a.isNoProject && b.isNoProject) return -1;
    return a.projectName.localeCompare(b.projectName, 'ru');
  });

  const toggleGroup = (key: string) => {
    setCollapsedProjectKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const openReceiveModal = (p: any) => {
    setReceivingPurchase(p);
    setWaybillNumber('');
    setWaybillFileUrl('');
    const initialQtys: Record<number, string> = {};
    for (const it of p.items || []) {
      const remaining = Math.max(0, (Number(it.quantity) || 0) - (Number(it.deliveredQty) || 0));
      initialQtys[it.id] = String(remaining);
    }
    setItemQuantities(initialQtys);
  };

  const handleConfirmReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingPurchase || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const receivedItems = (receivingPurchase.items || []).map((it: any) => ({
        itemId: it.id,
        qtyReceived: Math.max(0, Number(itemQuantities[it.id]) || 0),
      }));

      const res = await fetch('/api/purchases', {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: receivingPurchase.id,
          action: 'RECEIVE_DELIVERY',
          waybillNumber: waybillNumber.trim() || null,
          fileUrl: waybillFileUrl.trim() || null,
          receivedItems,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Ошибка при оформлении приемки', 'error');
        return;
      }
      showToast(
        data.status === 'PARTIALLY_DELIVERED'
          ? '📦 Принято частично (ожидается довоз остатка)'
          : '✅ Поставка полностью принята на склад',
        'success'
      );
      setReceivingPurchase(null);
      onRefresh();
    } catch (err) {
      console.error(err);
      showToast('Ошибка сети при приемке', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
        <h2 className="card-title" style={{ margin: 0 }}>📦 Склад: Приёмка поставок ТМЦ</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setSubTab('EXPECTED')}
            className="inline-btn"
            style={{
              background: subTab === 'EXPECTED' ? '#0ea5e9' : 'rgba(255,255,255,0.06)',
              color: subTab === 'EXPECTED' ? '#fff' : 'var(--text-muted)',
              fontWeight: 700,
              padding: '8px 14px',
            }}
          >
            🚚 Ожидаются к приемке ({expectedPurchases.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('RECEIVED')}
            className="inline-btn"
            style={{
              background: subTab === 'RECEIVED' ? '#10b981' : 'rgba(255,255,255,0.06)',
              color: subTab === 'RECEIVED' ? '#fff' : 'var(--text-muted)',
              fontWeight: 700,
              padding: '8px 14px',
            }}
          >
            📦 Принято на склад ({receivedPurchases.length})
          </button>
        </div>
      </div>

      <div style={{ position: 'relative', marginBottom: '18px' }}>
        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', fontSize: '0.9rem' }}>
          🔍
        </span>
        <input
          type="text"
          className="form-input"
          placeholder="Быстрый поиск: проект, наименование, артикул, накладная, #ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            paddingLeft: '36px',
            paddingRight: searchQuery ? '36px' : '12px',
            height: '38px',
            fontSize: '0.88rem',
          }}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            title="Очистить поиск"
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.95rem',
              padding: '4px 6px',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {subTab === 'EXPECTED' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {projectGroups.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '10px' }}>
              Сейчас нет поставок, ожидаемых к приемке на склад.
            </div>
          )}

          {projectGroups.map((group) => {
            const isCollapsed = collapsedProjectKeys.includes(group.key);
            const allItemsCount = group.purchases.reduce(
              (acc, p) => acc + (p.items?.length || 1),
              0
            );
            const nearestDate = group.purchases
              .map((p) => p.expectedDeliveryDate || p.plannedDeliveryDate)
              .filter(Boolean)
              .sort()[0];

            return (
              <div
                key={group.key}
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.02)',
                  overflow: 'hidden',
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    background: 'rgba(14, 165, 233, 0.08)',
                    border: 'none',
                    borderBottom: isCollapsed ? 'none' : '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                    📁 {group.projectName}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>Позиций: <strong style={{ color: '#38bdf8' }}>{allItemsCount}</strong></span>
                    {nearestDate && (
                      <span>Ближайшая дата: <strong style={{ color: '#fbbf24' }}>{formatDate(nearestDate)}</strong></span>
                    )}
                    <span>{isCollapsed ? '▼' : '▲'}</span>
                  </div>
                </button>

                {!isCollapsed && (
                  <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {group.purchases.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.08)',
                          background: 'rgba(15, 23, 42, 0.35)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                          <div>
                            <span style={{ fontWeight: 700 }}>Заявка #{p.id}: {p.title}</span>
                            <span
                              style={{
                                marginLeft: '10px',
                                fontSize: '0.72rem',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontWeight: 700,
                                background: p.status === 'PARTIALLY_DELIVERED' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                                color: p.status === 'PARTIALLY_DELIVERED' ? '#fbbf24' : '#60a5fa',
                              }}
                            >
                              {p.status === 'PARTIALLY_DELIVERED' ? 'ЧАСТИЧНО НА СКЛАДЕ' : 'В ПУТИ'}
                            </span>
                            {(p.expectedDeliveryDate || p.plannedDeliveryDate) && (
                              <span style={{ marginLeft: '10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                Ожидаемая дата: {formatDate(p.expectedDeliveryDate || p.plannedDeliveryDate)}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => openReceiveModal(p)}
                            className="inline-btn"
                            style={{ background: '#14b8a6', color: '#fff', fontWeight: 700, padding: '6px 14px' }}
                          >
                            📥 Принять поставку
                          </button>
                        </div>

                        {p.items && p.items.length > 0 ? (
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>Наименование</th>
                                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>Ед. изм.</th>
                                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>Заказано</th>
                                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>Принято ранее</th>
                                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>Осталось принять</th>
                                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>Ожидаемая дата</th>
                                </tr>
                              </thead>
                              <tbody>
                                {p.items.map((it: any) => {
                                  const remaining = Math.max(0, (Number(it.quantity) || 0) - (Number(it.deliveredQty) || 0));
                                  return (
                                    <tr key={it.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                      <td style={{ padding: '6px 8px' }}>{it.name}</td>
                                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>{it.unit}</td>
                                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>{it.quantity}</td>
                                      <td style={{ padding: '6px 8px', textAlign: 'center', color: '#10b981', fontWeight: 600 }}>{it.deliveredQty || 0}</td>
                                      <td style={{ padding: '6px 8px', textAlign: 'center', color: remaining > 0 ? '#fbbf24' : '#34d399', fontWeight: 700 }}>
                                        {remaining}
                                      </td>
                                      <td style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        {(p.expectedDeliveryDate || p.plannedDeliveryDate) ? formatDate(p.expectedDeliveryDate || p.plannedDeliveryDate) : '—'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Позиции не детализированы — примите поставку целиком по накладной.
                          </div>
                        )}

                        {p.waybills && p.waybills.length > 0 && (
                          <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {p.waybills.map((wb: any, idx: number) => (
                              <button
                                key={wb.id}
                                type="button"
                                onClick={() => setPreviewFile({ url: formatTelegramOrFileUrl(wb.fileUrl), title: `🚚 Накладная №${wb.waybillNumber || idx + 1}` })}
                                className="inline-btn"
                                style={{ fontSize: '0.73rem', padding: '3px 8px', background: 'rgba(20, 184, 166, 0.16)', color: '#2dd4bf' }}
                              >
                                🚚 Накладная {wb.waybillNumber ? `№${wb.waybillNumber}` : `#${idx + 1}`} ({formatDate(wb.receivedAt)})
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {subTab === 'RECEIVED' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Дата приёмки</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Проект / Заявка</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Позиции</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Накладные</th>
              </tr>
            </thead>
            <tbody>
              {receivedPurchases.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px' }}>{p.deliveredAt ? formatDate(p.deliveredAt) : formatDate(p.updatedAt)}</td>
                  <td style={{ padding: '10px' }}>
                    <div style={{ fontWeight: 700 }}>{p.title}</div>
                    <div style={{ fontSize: '0.78rem', color: '#38bdf8' }}>{p.project?.name || 'Складской запас'}</div>
                  </td>
                  <td style={{ padding: '10px' }}>
                    {p.items && p.items.length > 0 ? `${p.items.length} поз.` : 'Целиком'}
                  </td>
                  <td style={{ padding: '10px' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {(p.waybills || []).map((wb: any, idx: number) => (
                        <button
                          key={wb.id}
                          type="button"
                          onClick={() => setPreviewFile({ url: formatTelegramOrFileUrl(wb.fileUrl), title: `🚚 Накладная №${wb.waybillNumber || idx + 1}` })}
                          className="inline-btn"
                          style={{ fontSize: '0.73rem', padding: '3px 8px', background: 'rgba(20, 184, 166, 0.16)', color: '#2dd4bf' }}
                        >
                          🚚 Накладная {wb.waybillNumber ? `№${wb.waybillNumber}` : `#${idx + 1}`}
                        </button>
                      ))}
                      {(!p.waybills || p.waybills.length === 0) && p.deliveryNoteUrl && (
                        <button
                          type="button"
                          onClick={() => setPreviewFile({ url: formatTelegramOrFileUrl(p.deliveryNoteUrl), title: `🚚 Накладная (Заявка #${p.id})` })}
                          className="inline-btn"
                          style={{ fontSize: '0.73rem', padding: '3px 8px', background: 'rgba(20, 184, 166, 0.16)', color: '#2dd4bf' }}
                        >
                          🚚 Накладная
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {receivedPurchases.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Архив принятых поставок пуст.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Модальное окно частичной/полной приемки на склад */}
      {receivingPurchase && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="form-card" style={{ width: '580px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#151b26' }}>
            <h3 style={{ marginTop: 0, marginBottom: '6px' }}>📥 Приёмка поставки (Заявка #{receivingPurchase.id})</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 0, marginBottom: '14px' }}>
              {receivingPurchase.title} {receivingPurchase.project?.name ? `• ${receivingPurchase.project.name}` : ''}
            </p>
            <form onSubmit={handleConfirmReceive} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {receivingPurchase.items && receivingPurchase.items.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                    Укажите количество, фактически принятое в этой партии:
                  </label>
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                    {receivingPurchase.items.map((it: any) => {
                      const remaining = Math.max(0, (Number(it.quantity) || 0) - (Number(it.deliveredQty) || 0));
                      return (
                        <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', fontSize: '0.82rem' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>{it.name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              Заказано: {it.quantity} {it.unit} • Принято ранее: {it.deliveredQty || 0} • Осталось: {remaining}
                            </div>
                          </div>
                          <input
                            className="form-input"
                            type="number"
                            step="0.01"
                            min="0"
                            style={{ width: '95px' }}
                            value={itemQuantities[it.id] ?? ''}
                            onChange={(e) => setItemQuantities((prev) => ({ ...prev, [it.id]: e.target.value }))}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Номер накладной (опционально)
                </label>
                <input
                  className="form-input"
                  placeholder="Например: НК-452"
                  value={waybillNumber}
                  onChange={(e) => setWaybillNumber(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Фото / PDF накладной (авто-сжатие и загрузка в облако) *
                </label>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const url = await uploadFileCompressed(f, 'waybills', getAuthHeaders());
                    setWaybillFileUrl(url);
                    showToast('📎 Накладная сжата и загружена в облако', 'info');
                  }}
                />
                {waybillFileUrl && (
                  <div style={{ fontSize: '0.75rem', color: '#34d399', marginTop: '4px' }}>✅ Файл накладной прикреплен</div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="inline-btn" onClick={() => setReceivingPurchase(null)}>Отмена</button>
                <button type="submit" disabled={isSubmitting} className="btn-submit" style={{ background: '#14b8a6' }}>
                  {isSubmitting ? '⏳ Сохранение...' : '📥 Подтвердить приёмку'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  );
}
