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

  return (
    <div ref={ref} style={{ padding: '40px', fontFamily: '"Times New Roman", Times, serif', color: '#000', backgroundColor: '#fff', width: '210mm', minHeight: '297mm', boxSizing: 'border-box' }}>
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
        <div>{formattedDate} № {trip.id}-л/с</div>
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

      <div style={{ marginTop: '60px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
        <div style={{ fontWeight: 'bold' }}>Директор</div>
        
        {(trip.status === 'APPROVED' || trip.status === 'COMPLETED') && (
          <div style={{ position: 'absolute', left: '30%', top: '-10px', opacity: 0.85 }}>
            <img src="/images/signature.png" alt="Signature" style={{ width: '120px', height: '60px' }} />
          </div>
        )}

        <div style={{ fontWeight: 'bold' }}>К.Ж. Быкаев</div>
      </div>
    </div>
  );
});

PrintTripOrder.displayName = 'PrintTripOrder';
export default PrintTripOrder;
