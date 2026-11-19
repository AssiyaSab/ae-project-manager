import React, { forwardRef } from 'react';
import { formatDate } from '@/lib/formatters';
import { DIRECTOR_STAMP_SIGNATURE_DATA_URI } from '@/lib/signatureData';

interface PrintTripCertificateProps {
  trip: any;
}

const PrintTripCertificate = forwardRef<HTMLDivElement, PrintTripCertificateProps>(({ trip }, ref) => {
  if (!trip) return null;

  const start = new Date(trip.startDate);
  const end = new Date(trip.endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  const approvedDate = formatDate(trip.updatedAt || trip.createdAt);
  const orderDate = formatDate(trip.createdAt);
  const orderNumber = `${trip.id}-л/с`;

  const isApproved = trip.status === 'APPROVED' || trip.status === 'COMPLETED';

  return (
    <div
      ref={ref}
      style={{
        padding: '15px 25px',
        fontFamily: '"Times New Roman", Times, serif',
        color: '#000',
        backgroundColor: '#fff',
        width: '100%',
        maxWidth: '185mm',
        margin: '0 auto',
        boxSizing: 'border-box',
        fontSize: '12px',
        lineHeight: 1.35,
      }}
    >
      <style>{`@media print { @page { size: A4; margin: 12mm; } }`}</style>

      {/* 1. Шапка организации */}
      <div style={{ textAlign: 'center', marginBottom: '16px', borderBottom: '1px solid #000', paddingBottom: '8px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '14px', letterSpacing: '0.5px' }}>
          ТОО &quot;АЗИЯЭНЕРГОАВТОМАТИКА&quot;
        </div>
        <div style={{ fontSize: '11px', marginTop: '2px' }}>
          г. Алматы, ул. Бокейханова, 53а
        </div>
        <div style={{ fontSize: '11px' }}>
          тел.: 3862991, 2243162 &nbsp; факс: 3862994
        </div>
      </div>

      {/* 2. Заголовок документа */}
      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '15px', marginBottom: '18px' }}>
        КОМАНДИРОВОЧНОЕ УДОСТОВЕРЕНИЕ № {trip.id} от {approvedDate}
      </div>

      {/* 3. Основной блок (Левый: Штамп / Правый: Сведения о командировании) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', marginBottom: '20px' }}>
        {/* Левый блок */}
        <div style={{ width: '32%', minHeight: '145px', border: '1px dashed #666', padding: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'center', boxSizing: 'border-box' }}>
          <div style={{ fontSize: '10px', color: '#444' }}>
            Штамп учреждения (организации)
          </div>
          <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
            М.П.
          </div>
        </div>

        {/* Правый блок */}
        <div style={{ width: '68%', display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '12px' }}>
          <div>
            <strong>Выдано:</strong>{' '}
            <span style={{ textDecoration: 'underline' }}>
              {trip.employee?.name || '________________________'}, {trip.employee?.title || 'специалисту'}
            </span>
          </div>
          <div>
            <strong>командированному(й) в:</strong>{' '}
            <span style={{ textDecoration: 'underline' }}>{trip.destination}</span>
          </div>
          <div>
            <strong>Срок командировки:</strong>{' '}
            <span style={{ textDecoration: 'underline' }}>
              {diffDays} {diffDays % 10 === 1 && diffDays % 100 !== 11 ? 'день' : (diffDays % 10 >= 2 && diffDays % 10 <= 4 && (diffDays % 100 < 10 || diffDays % 100 >= 20)) ? 'дня' : 'дней'} с {formatDate(trip.startDate)} г. по {formatDate(trip.endDate)} г.
            </span>
          </div>
          <div>
            <strong>Направляется для:</strong>{' '}
            <span style={{ textDecoration: 'underline' }}>
              {trip.purpose || 'решения производственных вопросов'}
            </span>
          </div>
          <div>
            <strong>Основание:</strong>{' '}
            <span style={{ textDecoration: 'underline' }}>
              Приказ (распоряжение) О командировании от {orderDate} № {orderNumber}
            </span>
          </div>
          <div style={{ marginTop: '4px', fontStyle: 'italic', fontSize: '11px' }}>
            Действительно по предъявлению паспорта
          </div>
        </div>
      </div>

      {/* 4. Подпись руководителя и факсимиле печати */}
      <div style={{ position: 'relative', marginTop: '24px', marginBottom: '28px', paddingRight: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 'bold' }}>
          <span>Директор</span>
          <span>_________________________</span>
          <span>К.Ж. Быкаев</span>
        </div>

        {isApproved && (
          <div style={{ position: 'absolute', left: '95px', top: '-45px', opacity: 0.88, pointerEvents: 'none' }}>
            <img
              src={DIRECTOR_STAMP_SIGNATURE_DATA_URI}
              alt="Печать и подпись директора"
              style={{ width: '135px', height: '135px' }}
            />
          </div>
        )}
      </div>

      {/* 5. Нижний блок: Отметки о выбытии и прибытии */}
      <div style={{ marginTop: '25px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '11.5px', marginBottom: '8px' }}>
          Отметка о выбытии в командировку, прибытии в пункты назначения и выбытии из них:
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '11px' }}>
          <tbody>
            {[0, 1, 2, 3].map((rowIdx) => (
              <tr key={rowIdx}>
                <td style={{ border: '1px solid #000', padding: '10px 10px', width: '50%', verticalAlign: 'top' }}>
                  <div>Выбыл из ____________________________________</div>
                  <div style={{ marginTop: '8px' }}>«___» ________________ {start.getFullYear()} г.</div>
                  <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <span>Подпись ______________</span>
                    <span style={{ fontSize: '10px', color: '#444' }}>печать</span>
                  </div>
                </td>
                <td style={{ border: '1px solid #000', padding: '10px 10px', width: '50%', verticalAlign: 'top' }}>
                  <div>Прибыл в ____________________________________</div>
                  <div style={{ marginTop: '8px' }}>«___» ________________ {start.getFullYear()} г.</div>
                  <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <span>Подпись ______________</span>
                    <span style={{ fontSize: '10px', color: '#444' }}>печать</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 6. Сноска внизу */}
      <div style={{ marginTop: '10px', fontSize: '10px', fontStyle: 'italic', color: '#333' }}>
        Примечание: при выезде в несколько пунктов отметки о прибытии и выбытии делаются отдельно в каждом из них.
      </div>
    </div>
  );
});

PrintTripCertificate.displayName = 'PrintTripCertificate';
export default PrintTripCertificate;
