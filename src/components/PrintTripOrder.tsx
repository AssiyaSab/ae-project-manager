import React, { forwardRef } from 'react';
import { formatDate } from '@/lib/formatters';

interface PrintTripOrderProps {
  trip: any;
}

const PrintTripOrder = forwardRef<HTMLDivElement, PrintTripOrderProps>(({ trip }, ref) => {
  if (!trip) return null;

  const start = new Date(trip.startDate);
  const end = new Date(trip.endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  const creationDate = new Date(trip.createdAt);
  const monthsRu = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const formattedDate = `${creationDate.getDate()} ${monthsRu[creationDate.getMonth()]} ${creationDate.getFullYear()} года`;
  const approvedDateStr = formatDate(trip.approvedAt || trip.createdAt);
  const orderNum = trip.orderNumber || `${trip.id}-л/с`;
  const isApproved = ['APPROVED_BY_DIRECTOR', 'DOCS_READY', 'PAID', 'DOCS_SUBMITTED', 'APPROVED_FOR_PAYMENT', 'APPROVED', 'COMPLETED'].includes(trip.status);

  return (
    <div ref={ref} style={{ padding: '40px', fontFamily: '"Times New Roman", Times, serif', color: '#000', backgroundColor: '#fff', width: '210mm', minHeight: '297mm', boxSizing: 'border-box', position: 'relative' }}>
      {isApproved && (
        <div style={{ position: 'absolute', top: '22px', right: '40px', border: '2px solid #047857', borderRadius: '6px', padding: '6px 12px', color: '#047857', fontSize: '10.5px', lineHeight: 1.3, textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
          <div style={{ fontWeight: 'bold', fontSize: '12px', letterSpacing: '1px' }}>ОДОБРЕНО</div>
          <div>Быкаев К.Ж. (ЭЦП/система)</div>
          <div>Дата: {approvedDateStr}</div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', textAlign: 'center', fontWeight: 'bold' }}>
        <div style={{ width: '45%' }}>
          <div>ТОО</div>
          <div>"АзияЭнергоАвтоматика"</div>
          <div>{formattedDate}</div>
          <div style={{ marginTop: '20px', textTransform: 'uppercase' }}>БҰЙРЫҚ</div>
        </div>
        <div style={{ width: '45%' }}>
          <div>ТОО</div>
          <div>"АзияЭнергоАвтоматика"</div>
          <div>{formattedDate}</div>
          <div style={{ marginTop: '20px', textTransform: 'uppercase' }}>ПРИКАЗ</div>
        </div>
      </div>

      <hr style={{ borderTop: '1px solid #000', margin: '0 0 10px 0' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
        <div>{formattedDate} № {orderNum}</div>
        <div>город Алматы</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>Алматы қаласы</div>
        <div></div>
      </div>

      <div style={{ marginTop: '40px', fontWeight: 'bold' }}>
        О командировании
      </div>

      <div style={{ marginTop: '20px' }}>
        КОМАНДИРОВАТЬ
      </div>

      <div style={{ marginTop: '20px', lineHeight: '1.5', textAlign: 'justify' }}>
        {trip.employee?.name?.toUpperCase()}, {(trip.employee?.title || 'специалиста').toLowerCase()}, с {formatDate(trip.startDate)} г. по {formatDate(trip.endDate)} г. в г. {trip.destination} для {trip.purpose?.toLowerCase() || 'решения производственных вопросов'}.
        <br />
        Срок командировки: {diffDays} {diffDays === 1 ? 'день' : (diffDays >= 2 && diffDays <= 4) ? 'дня' : 'дней'}.
      </div>

      <div style={{ marginTop: '60px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 'bold' }}>Директор ___________________</div>
        <div style={{ fontWeight: 'bold' }}>К.Ж. Быкаев</div>
      </div>
      <div style={{ marginTop: '24px', fontWeight: 'bold' }}>М.П.</div>
    </div>
  );
});

PrintTripOrder.displayName = 'PrintTripOrder';
export default PrintTripOrder;
