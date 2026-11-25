import React, { useState, useEffect, useRef } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ru } from 'date-fns/locale';
import { formatDate } from '@/lib/formatters';
import { useReactToPrint } from 'react-to-print';
import PrintTripOrder from './PrintTripOrder';
import PrintTripCertificate from './PrintTripCertificate';
import {
  DEFAULT_TRIP_RATES,
  TripRates,
  calculateTripBudget,
} from '@/lib/tripRules';
import { useToast } from './ToastProvider';

export default function TripsTab({ currentUser, projects, users }: any) {
  const { showToast } = useToast();
  const [trips, setTrips] = useState<any[]>([]);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [confirmedKey, setConfirmedKey] = useState<string | null>(null);

  // Нормы суточных компании
  const [rates, setRates] = useState<TripRates>(DEFAULT_TRIP_RATES);
  const [showRatesModal, setShowRatesModal] = useState(false);
  const [editTier3MrpRate, setEditTier3MrpRate] = useState<string>(String(DEFAULT_TRIP_RATES.tier3MrpRate));
  const [editTierSeniorRate, setEditTierSeniorRate] = useState<string>(String(DEFAULT_TRIP_RATES.tierSeniorRate));
  const [editStandardRate, setEditStandardRate] = useState<string>(String(DEFAULT_TRIP_RATES.standardRate));

  // Поля создания командировки
  const [tripEmployee, setTripEmployee] = useState('');
  const [tripDest, setTripDest] = useState('');
  const [tripPurpose, setTripPurpose] = useState('');
  const [tripStart, setTripStart] = useState('');
  const [tripEnd, setTripEnd] = useState('');
  const [tripTransportCost, setTripTransportCost] = useState('');
  const [tripAccommodationCost, setTripAccommodationCost] = useState('');
  const [tripProject, setTripProject] = useState('');

  const [editingTrip, setEditingTrip] = useState<any>(null);

  // Модальное окно «Принять в работу» (Бухгалтерия: номера приказа/удостоверения + корректировка бюджета)
  const [inWorkTrip, setInWorkTrip] = useState<any>(null);
  const [inWorkOrderNumber, setInWorkOrderNumber] = useState('');
  const [inWorkCertificateNumber, setInWorkCertificateNumber] = useState('');
  const [inWorkTransportCost, setInWorkTransportCost] = useState('');
  const [inWorkAccommodationCost, setInWorkAccommodationCost] = useState('');
  const [inWorkBudget, setInWorkBudget] = useState('');

  const tripPrintRef = useRef(null);
  const [activeTripForPrint, setActiveTripForPrint] = useState<any>(null);
  const handlePrintTrip = useReactToPrint({
    contentRef: tripPrintRef,
    documentTitle: 'Prikaz_O_Komandirovanii',
  });

  const generateTripPDF = (trip: any) => {
    setActiveTripForPrint(trip);
    setTimeout(() => {
      handlePrintTrip();
    }, 100);
  };

  const tripCertPrintRef = useRef(null);
  const [activeTripForCertPrint, setActiveTripForCertPrint] = useState<any>(null);
  const handlePrintTripCert = useReactToPrint({
    contentRef: tripCertPrintRef,
    documentTitle: `Komandirovochnoe_Udostoverenie_${activeTripForCertPrint?.id || ''}`,
  });

  const generateTripCertificatePDF = (trip: any) => {
    setActiveTripForCertPrint(trip);
    setTimeout(() => {
      handlePrintTripCert();
    }, 100);
  };

  const pass = typeof window !== 'undefined' ? localStorage.getItem('ae_admin_password') : '';
  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'x-admin-password': pass || '',
    'x-auth-password': pass || '',
    'x-auth-login': (typeof window !== 'undefined' ? localStorage.getItem('ae_auth_login') : '') || currentUser?.login || '',
  });

  const isChiefAccountantOrAdmin =
    currentUser?.role === 'ADMIN' ||
    currentUser?.role === 'CHIEF_ACCOUNTANT' ||
    (currentUser?.role === 'ACCOUNTANT' && currentUser?.title?.toLowerCase().includes('главн'));

  const isAccountingOrAdmin = ['ADMIN', 'CHIEF_ACCOUNTANT', 'ACCOUNTANT'].includes(currentUser?.role);
  const canManageTrips = ['ADMIN', 'MANAGER', 'CHIEF_ACCOUNTANT', 'ACCOUNTANT'].includes(currentUser?.role);

  const fetchData = async () => {
    if (!pass && currentUser?.role !== 'ENGINEER' && currentUser?.role !== 'ASSEMBLER') return;
    try {
      const headers = getAuthHeaders();
      const [tripsRes, settingsRes] = await Promise.all([
        fetch('/api/trips', { headers }),
        fetch('/api/trips/settings', { headers }),
      ]);
      const tRes = await tripsRes.json();
      if (Array.isArray(tRes)) setTrips(tRes);

      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        const nextRates: TripRates = {
          tier3MrpRate: Number(sData.tier3MrpRate) || DEFAULT_TRIP_RATES.tier3MrpRate,
          tierSeniorRate: Number(sData.tierSeniorRate) || DEFAULT_TRIP_RATES.tierSeniorRate,
          standardRate: Number(sData.standardRate) || DEFAULT_TRIP_RATES.standardRate,
        };
        setRates(nextRates);
        setEditTier3MrpRate(String(nextRates.tier3MrpRate));
        setEditTierSeniorRate(String(nextRates.tierSeniorRate));
        setEditStandardRate(String(nextRates.standardRate));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [pass]);

  useEffect(() => {
    if (currentUser?.id && currentUser.id > 0 && currentUser.id !== 999 && !tripEmployee) {
      setTripEmployee(String(currentUser.id));
    }
  }, [currentUser]);

  // Автоматический расчет бюджета в реальном времени
  const selectedEmployee =
    users.find((u: any) => String(u.id) === String(tripEmployee)) || currentUser;
  const hasDates = Boolean(tripStart && tripEnd);
  const liveCalc = calculateTripBudget({
    startDate: tripStart || new Date(),
    endDate: tripEnd || tripStart || new Date(),
    employeeName: selectedEmployee?.name,
    rates,
    transportCost: tripTransportCost,
    accommodationCost: tripAccommodationCost,
  });

  const handleTripSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          employeeId: tripEmployee || (currentUser?.id > 0 ? currentUser.id : ''),
          destination: tripDest,
          purpose: tripPurpose,
          startDate: tripStart,
          endDate: tripEnd,
          transportCost: Number(tripTransportCost) || 0,
          accommodationCost: Number(tripAccommodationCost) || 0,
          projectId: tripProject || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Не удалось создать командировку');
        return;
      }
      setTripEmployee(currentUser?.id && currentUser.id > 0 && currentUser.id !== 999 ? String(currentUser.id) : '');
      setTripDest('');
      setTripPurpose('');
      setTripStart('');
      setTripEnd('');
      setTripTransportCost('');
      setTripAccommodationCost('');
      setTripProject('');
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveRates = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/trips/settings', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          tier3MrpRate: Number(editTier3MrpRate),
          tierSeniorRate: Number(editTierSeniorRate),
          standardRate: Number(editStandardRate),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Ошибка сохранения норм суточных');
        return;
      }
      setRates(data);
      setShowRatesModal(false);
    } catch (e) {
      console.error(e);
    }
  };

  const updateTripStatus = async (id: number, status: string, actionKey?: string) => {
    if (!['ADMIN', 'MANAGER', 'ACCOUNTANT', 'CHIEF_ACCOUNTANT'].includes(currentUser?.role)) return;
    const key = actionKey || `trip_${id}_${status}`;
    if (loadingKey === key) return;
    setLoadingKey(key);
    try {
      const res = await fetch('/api/trips', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Ошибка обновления статуса командировки', 'error');
        return;
      }
      setConfirmedKey(key);
      showToast('✅ Статус командировки обновлен', 'success');
      setTimeout(() => setConfirmedKey((prev) => (prev === key ? null : prev)), 1800);
      fetchData();
    } catch (e) {
      console.error(e);
      showToast('Ошибка сети при обновлении командировки', 'error');
    } finally {
      setLoadingKey(null);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrip) return;
    try {
      await fetch('/api/trips', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: editingTrip.id,
          employeeId: editingTrip.employeeId,
          destination: editingTrip.destination,
          purpose: editingTrip.purpose,
          startDate: editingTrip.startDate,
          endDate: editingTrip.endDate,
          transportCost: Number(editingTrip.transportCost) || 0,
          accommodationCost: Number(editingTrip.accommodationCost) || 0,
          ...(isAccountingOrAdmin && editingTrip.manualOverrideBudget !== undefined
            ? { totalBudget: Number(editingTrip.manualOverrideBudget) }
            : {}),
          projectId: editingTrip.projectId || null,
        }),
      });
      setEditingTrip(null);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTrip = async (id: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить командировку?')) return;
    try {
      await fetch('/api/trips?id=' + id, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const formatBreakdown = (t: any) => {
    const days = t.daysCount || 1;
    const dailyTotal = t.dailyAllowanceTotal || 0;
    const tr = t.transportCost || 0;
    const acc = t.accommodationCost || 0;
    if (dailyTotal === 0 && tr === 0 && acc === 0) return 'По тарифу / архив';
    const parts: string[] = [`Суточные ${days} дн. (${dailyTotal.toLocaleString('ru-RU')} ₸)`];
    if (tr > 0) parts.push(`проезд ${tr.toLocaleString('ru-RU')} ₸`);
    if (acc > 0) parts.push(`прожив. ${acc.toLocaleString('ru-RU')} ₸`);
    return parts.join(' + ');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '15px' }}>
          <h2 className="card-title" style={{ margin: 0 }}>✈️ Командировки</h2>
          {isChiefAccountantOrAdmin && (
            <button
              type="button"
              onClick={() => setShowRatesModal(true)}
              className="inline-btn"
              style={{ fontSize: '0.8rem', padding: '6px 12px', background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px' }}
            >
              ⚙️ Нормы суточных ({rates.tier3MrpRate.toLocaleString('ru-RU')} / {rates.tierSeniorRate.toLocaleString('ru-RU')} / {rates.standardRate.toLocaleString('ru-RU')} ₸)
            </button>
          )}
        </div>

        <form
          onSubmit={handleTripSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '20px',
            padding: '16px',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
          }}
        >
          {/* Строка 1: Сотрудник, Направление, Цель, Проект */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <select className="form-select" value={tripEmployee} onChange={(e) => setTripEmployee(e.target.value)} required style={{ flex: '1 1 170px' }}>
              <option value="">-- Сотрудник --</option>
              {users.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>

            <input
              className="form-input"
              placeholder="Пункт назначения / Город / Объект *"
              value={tripDest}
              onChange={(e) => setTripDest(e.target.value)}
              required
              style={{ flex: '1 1 200px' }}
            />

            <input
              className="form-input"
              placeholder="Цель поездки *"
              value={tripPurpose}
              onChange={(e) => setTripPurpose(e.target.value)}
              required
              style={{ flex: '1 1 200px' }}
            />

            <select className="form-select" value={tripProject} onChange={(e) => setTripProject(e.target.value)} style={{ flex: '1 1 170px' }}>
              <option value="">-- Проект (опционально) --</option>
              {projects.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Строка 2: Даты, Авто-суточные (read-only), Проезд, Проживание */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Даты с — по *</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <DatePicker
                  selected={tripStart ? new Date(tripStart) : null}
                  onChange={(date: Date | null) => setTripStart(date ? date.toISOString().split('T')[0] : '')}
                  dateFormat="dd/MM/yyyy"
                  locale={ru}
                  className="form-input"
                  placeholderText="С даты"
                  required
                  wrapperClassName="date-picker-wrapper"
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>по</span>
                <DatePicker
                  selected={tripEnd ? new Date(tripEnd) : null}
                  onChange={(date: Date | null) => setTripEnd(date ? date.toISOString().split('T')[0] : '')}
                  dateFormat="dd/MM/yyyy"
                  locale={ru}
                  className="form-input"
                  placeholderText="По дату"
                  required
                  wrapperClassName="date-picker-wrapper"
                />
              </div>
            </div>

            {/* Автоматический расчет суточных (только чтение) */}
            <div style={{ flex: '1 1 190px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Суточные (авто-расчет)
              </label>
              <input
                className="form-input"
                readOnly
                value={
                  hasDates
                    ? `${liveCalc.daysCount} дн. × ${liveCalc.dailyAllowanceRate.toLocaleString('ru-RU')} = ${liveCalc.dailyAllowanceTotal.toLocaleString('ru-RU')} ₸`
                    : 'Выберите даты с и по'
                }
                style={{
                  background: 'rgba(14, 165, 233, 0.08)',
                  border: '1px solid rgba(14, 165, 233, 0.3)',
                  color: hasDates ? '#38bdf8' : 'var(--text-muted)',
                  fontWeight: 600,
                  cursor: 'not-allowed',
                }}
                title="Рассчитывается автоматически по утвержденной норме компании"
              />
            </div>

            <div style={{ flex: '0 1 145px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Проезд / Билеты (₸)
              </label>
              <input
                className="form-input"
                type="number"
                min="0"
                placeholder="0 ₸ (опц.)"
                value={tripTransportCost}
                onChange={(e) => setTripTransportCost(e.target.value)}
              />
            </div>

            <div style={{ flex: '0 1 145px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Проживание (₸)
              </label>
              <input
                className="form-input"
                type="number"
                min="0"
                placeholder="0 ₸ (опц.)"
                value={tripAccommodationCost}
                onChange={(e) => setTripAccommodationCost(e.target.value)}
              />
            </div>
          </div>

          {/* Строка 3: Итого к выдаче + кнопка отправки */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingTop: '6px', borderTop: '1px dashed var(--border-color)' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.14)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#10b981',
                fontWeight: 700,
                fontSize: '0.95rem',
              }}
            >
              <span>💰 Итого к выдаче:</span>
              <span>{hasDates ? `${liveCalc.totalBudget.toLocaleString('ru-RU')} ₸` : '—'}</span>
            </div>

            <button className="btn-submit" type="submit" style={{ margin: 0, padding: '10px 24px' }}>
              🚀 Отправить заявку на командировку
            </button>
          </div>
        </form>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Сотрудник</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Назначение</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Сроки</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Проект</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Бюджет</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Статус</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Документ</th>
                {canManageTrips && <th style={{ padding: '10px', textAlign: 'left' }}>Действия</th>}
              </tr>
            </thead>
            <tbody>
              {trips.map((t) => {
                const displayBudget = t.totalBudget > 0 ? t.totalBudget : t.budget || 0;
                const breakdown = formatBreakdown(t);
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px', fontWeight: 600 }}>{t.employee?.name}</td>
                    <td style={{ padding: '10px' }}>{t.destination}</td>
                    <td style={{ padding: '10px' }}>
                      <div>
                        {formatDate(t.startDate)} - {formatDate(t.endDate)}
                      </div>
                      {t.daysCount > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.daysCount} дн.</div>
                      )}
                    </td>
                    <td style={{ padding: '10px' }}>{t.project?.name || '-'}</td>
                    <td style={{ padding: '10px' }} title={breakdown}>
                      <div style={{ fontWeight: 700 }}>{displayBudget.toLocaleString('ru-RU')} ₸</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{breakdown}</div>
                    </td>
                    <td style={{ padding: '10px' }}>
                      {(() => {
                        const badgeMap: Record<string, { label: string; bg: string; color: string }> = {
                          PENDING_APPROVAL: { label: '1. НА СОГЛАСОВАНИИ (ДИРЕКТОР)', bg: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' },
                          PENDING_BUDGET: { label: '1. НА СОГЛАСОВАНИИ (ДИРЕКТОР)', bg: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' },
                          PENDING: { label: '1. НА СОГЛАСОВАНИИ (ДИРЕКТОР)', bg: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' },
                          APPROVED_BY_DIRECTOR: { label: '2. ОДОБРЕНО (В БУХГАЛТЕРИИ)', bg: 'rgba(168, 85, 247, 0.2)', color: '#c084fc' },
                          DOCS_READY: { label: '3. ДОКУМЕНТЫ ГОТОВЫ (К ОПЛАТЕ)', bg: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' },
                          APPROVED_FOR_PAYMENT: { label: '3. ДОКУМЕНТЫ ГОТОВЫ (К ОПЛАТЕ)', bg: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' },
                          APPROVED: { label: '3. ДОКУМЕНТЫ ГОТОВЫ (К ОПЛАТЕ)', bg: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' },
                          PAID: { label: '4. ОПЛАЧЕНО', bg: 'rgba(16, 185, 129, 0.2)', color: '#10b981' },
                          DOCS_SUBMITTED: { label: '5. ДОКУМЕНТЫ СДАНЫ', bg: 'rgba(20, 184, 166, 0.2)', color: '#2dd4bf' },
                          COMPLETED: { label: '5. ДОКУМЕНТЫ СДАНЫ', bg: 'rgba(20, 184, 166, 0.2)', color: '#2dd4bf' },
                          REJECTED: { label: 'ОТКЛОНЕНО', bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' },
                        };
                        const info = badgeMap[t.status] || { label: t.status, bg: 'rgba(255,255,255,0.1)', color: '#fff' };
                        return (
                          <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.73rem', fontWeight: 'bold', background: info.bg, color: info.color, whiteSpace: 'nowrap' }}>
                            {info.label}
                          </span>
                        );
                      })()}
                      {t.orderNumber && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Приказ №{t.orderNumber} {t.certificateNumber ? `• Уд. №${t.certificateNumber}` : ''}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {['DOCS_READY', 'PAID', 'DOCS_SUBMITTED', 'APPROVED_FOR_PAYMENT', 'APPROVED', 'COMPLETED'].includes(t.status) ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-start' }}>
                          <button
                            onClick={() => generateTripPDF(t)}
                            className="inline-btn"
                            style={{ background: '#3b82f6', color: '#fff', fontSize: '0.75rem', padding: '4px 8px', whiteSpace: 'nowrap' }}
                          >
                            📄 Приказ (PDF)
                          </button>
                          <button
                            onClick={() => generateTripCertificatePDF(t)}
                            className="inline-btn"
                            style={{ background: '#10b981', color: '#fff', fontSize: '0.75rem', padding: '4px 8px', whiteSpace: 'nowrap' }}
                          >
                            📄 Командировочное удостоверение (PDF)
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          ⏳ После оформления в бухгалтерии
                        </span>
                      )}
                    </td>
                    {canManageTrips && (
                      <td style={{ padding: '10px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                        {(t.status === 'PENDING_APPROVAL' || t.status === 'PENDING' || t.status === 'PENDING_BUDGET') && ['ADMIN', 'MANAGER'].includes(currentUser?.role) && (
                          <>
                            {(() => {
                              const k = `trip_${t.id}_APPROVED_BY_DIRECTOR`;
                              const isL = loadingKey === k;
                              const isC = confirmedKey === k;
                              return (
                                <button
                                  disabled={isL}
                                  onClick={() => updateTripStatus(t.id, 'APPROVED_BY_DIRECTOR', k)}
                                  className="inline-btn"
                                  style={{ background: isC ? '#10b981' : 'rgba(16, 185, 129, 0.15)', color: isC ? '#fff' : '#10b981' }}
                                >
                                  {isL ? '⏳ Сохранение...' : isC ? '✅ Подтверждено' : '✅ Одобрить'}
                                </button>
                              );
                            })()}
                            <button
                              disabled={loadingKey === `trip_${t.id}_REJECTED`}
                              onClick={() => updateTripStatus(t.id, 'REJECTED', `trip_${t.id}_REJECTED`)}
                              className="inline-btn"
                              style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                            >
                              {loadingKey === `trip_${t.id}_REJECTED` ? '⏳...' : '❌'}
                            </button>
                          </>
                        )}

                        {t.status === 'APPROVED_BY_DIRECTOR' && isAccountingOrAdmin && (
                          <button
                            onClick={() => {
                              setInWorkTrip(t);
                              setInWorkOrderNumber(t.orderNumber || `${t.id}-л/с`);
                              setInWorkCertificateNumber(t.certificateNumber || String(t.id));
                              setInWorkTransportCost(String(t.transportCost ?? 0));
                              setInWorkAccommodationCost(String(t.accommodationCost ?? 0));
                              setInWorkBudget(String(t.totalBudget > 0 ? t.totalBudget : t.budget || 0));
                            }}
                            className="inline-btn"
                            style={{ background: '#8b5cf6', color: '#fff', fontWeight: 600 }}
                          >
                            ⚙️ Принять в работу
                          </button>
                        )}

                        {(t.status === 'DOCS_READY' || t.status === 'APPROVED_FOR_PAYMENT' || t.status === 'APPROVED') && isAccountingOrAdmin && (() => {
                          const k = `trip_${t.id}_PAID`;
                          const isL = loadingKey === k;
                          const isC = confirmedKey === k;
                          return (
                            <button
                              disabled={isL}
                              onClick={() => updateTripStatus(t.id, 'PAID', k)}
                              className="inline-btn"
                              style={{ background: '#10b981', color: '#fff', fontWeight: 600, opacity: isL ? 0.7 : 1 }}
                            >
                              {isL ? '⏳ Сохранение...' : isC ? '✅ Подтверждено' : '💳 Подтвердить оплату'}
                            </button>
                          );
                        })()}

                        {t.status === 'PAID' && isAccountingOrAdmin && (() => {
                          const k = `trip_${t.id}_DOCS_SUBMITTED`;
                          const isL = loadingKey === k;
                          const isC = confirmedKey === k;
                          return (
                            <button
                              disabled={isL}
                              onClick={() => updateTripStatus(t.id, 'DOCS_SUBMITTED', k)}
                              className="inline-btn"
                              style={{ background: isC ? '#10b981' : '#0ea5e9', color: '#fff', fontWeight: 600, opacity: isL ? 0.7 : 1 }}
                            >
                              {isL ? '⏳ Сохранение...' : isC ? '✅ Подтверждено' : '📄 Документы сданы'}
                            </button>
                          );
                        })()}

                        {isAccountingOrAdmin && (
                          <button
                            onClick={() =>
                              setEditingTrip({
                                ...t,
                                manualOverrideBudget: t.totalBudget > 0 ? t.totalBudget : t.budget || 0,
                              })
                            }
                            className="inline-btn"
                            style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}
                            title="Редактировать / скорректировать сумму"
                          >
                            ✏️
                          </button>
                        )}
                        {currentUser?.role === 'ADMIN' && (
                          <button onClick={() => handleDeleteTrip(t.id)} className="inline-btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                            🗑️
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {trips.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Командировок нет.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Модальное окно настройки ставок суточных (ADMIN / CHIEF_ACCOUNTANT) */}
      {showRatesModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="form-card" style={{ width: '440px', background: '#151b26' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px' }}>⚙️ Нормы суточных компании</h3>
            <form onSubmit={handleSaveRates} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                  3 МРП — Быкаев Канат, Быкаев Жанат, Канабеков Ерлик (₸ / сутки)
                </label>
                <input className="form-input" type="number" min="1" value={editTier3MrpRate} onChange={(e) => setEditTier3MrpRate(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                  Спец. ставка — Ражапов Мырзабек, Ан Александр (₸ / сутки)
                </label>
                <input className="form-input" type="number" min="1" value={editTierSeniorRate} onChange={(e) => setEditTierSeniorRate(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                  Остальные сотрудники (₸ / сутки)
                </label>
                <input className="form-input" type="number" min="1" value={editStandardRate} onChange={(e) => setEditStandardRate(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="inline-btn" onClick={() => setShowRatesModal(false)}>
                  Отмена
                </button>
                <button type="submit" className="btn-submit">
                  Сохранить нормы
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно редактирования/корректировки командировки */}
      {editingTrip && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="form-card" style={{ width: '440px', background: '#151b26' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Редактировать командировку #{editingTrip.id}</h3>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <select className="form-select" value={editingTrip.employeeId} onChange={(e) => setEditingTrip({ ...editingTrip, employeeId: e.target.value })} required>
                {users.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <input className="form-input" value={editingTrip.destination} onChange={(e) => setEditingTrip({ ...editingTrip, destination: e.target.value })} required />
              <input className="form-input" value={editingTrip.purpose} onChange={(e) => setEditingTrip({ ...editingTrip, purpose: e.target.value })} required />

              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <DatePicker
                  selected={editingTrip.startDate ? new Date(editingTrip.startDate) : null}
                  onChange={(date: Date | null) => setEditingTrip({ ...editingTrip, startDate: date ? date.toISOString().split('T')[0] : '' })}
                  dateFormat="dd/MM/yyyy"
                  locale={ru}
                  className="form-input"
                  required
                  wrapperClassName="date-picker-wrapper"
                />
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>по</span>
                <DatePicker
                  selected={editingTrip.endDate ? new Date(editingTrip.endDate) : null}
                  onChange={(date: Date | null) => setEditingTrip({ ...editingTrip, endDate: date ? date.toISOString().split('T')[0] : '' })}
                  dateFormat="dd/MM/yyyy"
                  locale={ru}
                  className="form-input"
                  required
                  wrapperClassName="date-picker-wrapper"
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Проезд (₸)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    value={editingTrip.transportCost ?? 0}
                    onChange={(e) => setEditingTrip({ ...editingTrip, transportCost: e.target.value })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Проживание (₸)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    value={editingTrip.accommodationCost ?? 0}
                    onChange={(e) => setEditingTrip({ ...editingTrip, accommodationCost: e.target.value })}
                  />
                </div>
              </div>

              {isAccountingOrAdmin && (
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#fbbf24' }}>Итоговая сумма (корректировка Бухгалтерии/Директора, ₸)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    value={editingTrip.manualOverrideBudget ?? editingTrip.budget}
                    onChange={(e) => setEditingTrip({ ...editingTrip, manualOverrideBudget: e.target.value })}
                  />
                </div>
              )}

              <select className="form-select" value={editingTrip.projectId || ''} onChange={(e) => setEditingTrip({ ...editingTrip, projectId: e.target.value })}>
                <option value="">-- Проект (опционально) --</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="inline-btn" onClick={() => setEditingTrip(null)}>
                  Отмена
                </button>
                <button type="submit" className="btn-submit">
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно «Принять в работу» (Бухгалтерия: номера документов + бюджет) */}
      {inWorkTrip && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="form-card" style={{ width: '460px', background: '#151b26' }}>
            <h3 style={{ marginTop: 0, marginBottom: '6px' }}>⚙️ Принять командировку в работу #{inWorkTrip.id}</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 0, marginBottom: '14px' }}>
              {inWorkTrip.employee?.name} • {inWorkTrip.destination}
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const key = `trip_${inWorkTrip.id}_DOCS_READY`;
                if (loadingKey === key) return;
                setLoadingKey(key);
                try {
                  const res = await fetch('/api/trips', {
                    method: 'PATCH',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                      id: inWorkTrip.id,
                      status: 'DOCS_READY',
                      orderNumber: inWorkOrderNumber.trim(),
                      certificateNumber: inWorkCertificateNumber.trim(),
                      transportCost: Number(inWorkTransportCost) || 0,
                      accommodationCost: Number(inWorkAccommodationCost) || 0,
                      ...(inWorkBudget ? { totalBudget: Number(inWorkBudget) } : {}),
                    }),
                  });
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    showToast(err.error || 'Ошибка сохранения', 'error');
                    return;
                  }
                  showToast('✅ Номера присвоены, PDF-документы доступны', 'success');
                  setInWorkTrip(null);
                  fetchData();
                } catch (err) {
                  console.error(err);
                } finally {
                  setLoadingKey(null);
                }
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Регистрационный номер приказа *
                </label>
                <input
                  className="form-input"
                  placeholder="Например: 264-л/с"
                  value={inWorkOrderNumber}
                  onChange={(e) => setInWorkOrderNumber(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Номер командировочного удостоверения *
                </label>
                <input
                  className="form-input"
                  placeholder="Например: 45"
                  value={inWorkCertificateNumber}
                  onChange={(e) => setInWorkCertificateNumber(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Проезд (₸)</label>
                  <input className="form-input" type="number" min="0" value={inWorkTransportCost} onChange={(e) => setInWorkTransportCost(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Проживание (₸)</label>
                  <input className="form-input" type="number" min="0" value={inWorkAccommodationCost} onChange={(e) => setInWorkAccommodationCost(e.target.value)} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#fbbf24', marginBottom: '4px' }}>
                  Итоговая сумма бюджета (₸)
                </label>
                <input className="form-input" type="number" min="0" value={inWorkBudget} onChange={(e) => setInWorkBudget(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button type="button" className="inline-btn" onClick={() => setInWorkTrip(null)}>Отмена</button>
                <button type="submit" disabled={loadingKey === `trip_${inWorkTrip.id}_DOCS_READY`} className="btn-submit" style={{ background: '#8b5cf6' }}>
                  {loadingKey === `trip_${inWorkTrip.id}_DOCS_READY` ? '⏳ Сохранение...' : '✅ Сохранить и открыть PDF'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ display: 'none' }}>
        <PrintTripOrder ref={tripPrintRef} trip={activeTripForPrint} />
        <PrintTripCertificate ref={tripCertPrintRef} trip={activeTripForCertPrint} />
      </div>
    </div>
  );
}
