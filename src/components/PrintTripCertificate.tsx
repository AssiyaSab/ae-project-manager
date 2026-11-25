import React, { forwardRef } from 'react';
import { formatDate } from '@/lib/formatters';

interface PrintTripCertificateProps {
  trip: any;
}

const PrintTripCertificate = forwardRef<HTMLDivElement, PrintTripCertificateProps>(({ trip }, ref) => {
  if (!trip) return null;

  const start = new Date(trip.startDate);
  const end = new Date(trip.endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  const daysWord =
    diffDays % 10 === 1 && diffDays % 100 !== 11
      ? 'день'
      : diffDays % 10 >= 2 && diffDays % 10 <= 4 && (diffDays % 100 < 10 || diffDays % 100 >= 20)
      ? 'дня'
      : 'дней';

  const orderDate = formatDate(trip.approvedAt || trip.createdAt);
  const orderNumber = trip.orderNumber || `${trip.id}-л/с`;
  const certNumber = trip.certificateNumber || String(trip.id);
  const docYear = start.getFullYear() || new Date().getFullYear();

  const isApproved = ['APPROVED_BY_DIRECTOR', 'DOCS_READY', 'PAID', 'DOCS_SUBMITTED', 'APPROVED_FOR_PAYMENT', 'APPROVED', 'COMPLETED'].includes(trip.status);
  const mintBg = '#d9ebe5';

  return (
    <div
      ref={ref}
      style={{
        padding: '15px 24px',
        fontFamily: '"Times New Roman", Times, serif',
        color: '#000',
        backgroundColor: '#fff',
        width: '100%',
        maxWidth: '188mm',
        margin: '0 auto',
        boxSizing: 'border-box',
        fontSize: '11.5px',
        lineHeight: 1.3,
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      {/* ВЕРХНИЙ БЛОК (Светло-зелёный фон 1С + белые поля) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          backgroundColor: mintBg,
          padding: '12px 14px',
          borderBottom: '1px solid #000',
          marginBottom: '16px',
        }}
      >
        {/* Левая колонка: Штамп, дата, М.П. */}
        <div
          style={{
            width: '30%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            paddingTop: '75px',
            paddingBottom: '24px',
            paddingRight: '12px',
            textAlign: 'center',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: '10.5px', lineHeight: 1.25 }}>
            Штамп учреждения
            <br />
            (организации)
          </div>

          <div style={{ fontSize: '11px', marginTop: '30px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
            <span>от</span>
            <span style={{ backgroundColor: '#fff', padding: '1px 6px', minWidth: '20px', display: 'inline-block' }}>&nbsp;</span>
            <span style={{ backgroundColor: '#fff', padding: '1px 10px', minWidth: '55px', display: 'inline-block' }}>&nbsp;</span>
            <span style={{ backgroundColor: '#fff', padding: '1px 5px', fontWeight: 500 }}>{docYear}</span>
          </div>

          <div style={{ fontSize: '11.5px', fontWeight: 'bold', marginTop: '45px' }}>
            М.П.
          </div>
        </div>

        {/* Правая колонка с левой вертикальной чертой */}
        <div
          style={{
            width: '70%',
            borderLeft: '1px solid #000',
            paddingLeft: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            boxSizing: 'border-box',
          }}
        >
          {/* Шапка организации + Штамп ОДОБРЕНО */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ borderBottom: '1px solid #000', paddingBottom: '4px', marginBottom: '2px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '13px', letterSpacing: '0.3px' }}>
                  ТОО &quot;АЗИЯЭНЕРГОАВТОМАТИКА&quot;
                </div>
              </div>
              <div style={{ fontSize: '10.5px', lineHeight: 1.25 }}>
                г. Алматы, ул. Бокейханова, 53а
                <br />
                тел.: 3862991, 2243162 факс: 3862994
              </div>
            </div>
            {isApproved && (
              <div style={{ border: '1.5px solid #047857', borderRadius: '5px', padding: '4px 8px', color: '#047857', fontSize: '9px', lineHeight: 1.25, textAlign: 'center', fontFamily: 'Arial, sans-serif', backgroundColor: '#fff', flexShrink: 0 }}>
                <div style={{ fontWeight: 'bold', fontSize: '10px', letterSpacing: '0.5px' }}>ОДОБРЕНО</div>
                <div>Быкаев К.Ж. (ЭЦП/система)</div>
                <div>Дата: {orderDate}</div>
              </div>
            )}
          </div>

          {/* Заголовок */}
          <div style={{ fontWeight: 'bold', fontSize: '13px', marginTop: '6px', marginBottom: '4px' }}>
            КОМАНДИРОВОЧНОЕ УДОСТОВЕРЕНИЕ &nbsp; № {certNumber}
          </div>

          {/* Выдано */}
          <div>
            <div style={{ fontSize: '10.5px', marginBottom: '2px' }}>Выдано</div>
            <div style={{ backgroundColor: '#fff', padding: '4px 6px', fontWeight: 500, fontSize: '12px' }}>
              {trip.employee?.name || '________________________'}, {trip.employee?.title || 'специалист'}
            </div>
          </div>

          {/* Командированному в */}
          <div>
            <div style={{ fontSize: '10.5px', marginBottom: '2px' }}>командированному(й) в</div>
            <div style={{ backgroundColor: '#fff', padding: '4px 6px', fontWeight: 500, fontSize: '12px' }}>
              {trip.destination}
            </div>
          </div>

          {/* Срок командировки */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
            <span style={{ fontSize: '10.5px' }}>Срок командировки</span>
            <span style={{ backgroundColor: '#fff', padding: '2px 12px', fontWeight: 500 }}>
              {diffDays} {daysWord}
            </span>
            <span style={{ fontSize: '10.5px' }}>с</span>
            <span style={{ backgroundColor: '#fff', padding: '2px 10px', fontWeight: 500 }}>
              {formatDate(trip.startDate)}
            </span>
            <span style={{ fontSize: '10.5px' }}>по</span>
            <span style={{ backgroundColor: '#fff', padding: '2px 10px', fontWeight: 500 }}>
              {formatDate(trip.endDate)}
            </span>
          </div>

          {/* Направляется для */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '2px' }}>
            <span style={{ whiteSpace: 'nowrap', fontSize: '10.5px', paddingTop: '4px' }}>Направляется для</span>
            <span style={{ backgroundColor: '#fff', flex: 1, padding: '4px 6px', minHeight: '26px' }}>
              {trip.purpose || 'решения производственных вопросов'}
            </span>
          </div>

          {/* Разделитель перед Основанием */}
          <div style={{ borderTop: '1px solid #000', marginTop: '6px', paddingTop: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ whiteSpace: 'nowrap', fontSize: '10.5px' }}>Основание: Приказ (распоряжение)</span>
              <span style={{ backgroundColor: '#fff', flex: 1, textAlign: 'center', fontWeight: 500, padding: '2px 6px' }}>
                О командировании
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <span style={{ fontSize: '10.5px' }}>от</span>
              <span style={{ backgroundColor: '#fff', padding: '2px 10px', minWidth: '80px', textAlign: 'center' }}>{orderDate}</span>
              <span style={{ fontSize: '10.5px' }}>№</span>
              <span style={{ backgroundColor: '#fff', padding: '2px 10px', minWidth: '65px', textAlign: 'center', fontWeight: 500 }}>{orderNumber}</span>
            </div>
          </div>

          {/* Действительно по предъявлению паспорта */}
          <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: 'bold', textAlign: 'center' }}>
            Действительно по предъявлению паспорта
          </div>

          {/* Чистая строка подписи директора (без факсимиле) */}
          <div style={{ marginTop: '12px', paddingBottom: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontWeight: 'bold' }}>
              <span>Директор ___________________</span>
              <div style={{ flex: 1, backgroundColor: '#fff', padding: '3px 10px', textAlign: 'right' }}>
                К.Ж. Быкаев
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* НИЖНИЙ БЛОК: Светло-зелёная подложка + 8 белых рамочек */}
      <div style={{ backgroundColor: mintBg, padding: '12px 14px' }}>
        <div style={{ fontSize: '11.5px', fontWeight: 'bold', textAlign: 'center', marginBottom: '10px' }}>
          Отметка о выбытии в командировку, прибытии в пункты назначения и выбытии из них:
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[0, 1, 2, 3].map((rowIdx) => (
            <div key={rowIdx} style={{ display: 'flex', gap: '16px' }}>
              {/* Левая рамка: Выбыл из */}
              <div style={{ flex: 1, border: '1px solid #000', backgroundColor: '#fff', padding: '6px 8px', fontSize: '10.5px', boxSizing: 'border-box' }}>
                <div>Выбыл из ___________________________________</div>
                <div style={{ marginTop: '8px' }}>
                  Подпись __________ &nbsp; &quot;____&quot; _________ {docYear} г.
                </div>
                <div style={{ marginTop: '4px', paddingLeft: '14px', fontSize: '9.5px' }}>
                  печать
                </div>
              </div>

              {/* Правая рамка: Прибыл в */}
              <div style={{ flex: 1, border: '1px solid #000', backgroundColor: '#fff', padding: '6px 8px', fontSize: '10.5px', boxSizing: 'border-box' }}>
                <div>Прибыл в ___________________________________</div>
                <div style={{ marginTop: '8px' }}>
                  Подпись __________ &nbsp; &quot;____&quot; _________ {docYear} г.
                </div>
                <div style={{ marginTop: '4px', paddingLeft: '14px', fontSize: '9.5px' }}>
                  печать
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Примечание */}
        <div style={{ marginTop: '12px', fontSize: '10px' }}>
          <strong>Примечание:</strong> &nbsp; при выезде в несколько пунктов отметки о прибытии и выбытии делаются отдельно в каждом из них.
        </div>
      </div>
    </div>
  );
});

PrintTripCertificate.displayName = 'PrintTripCertificate';
export default PrintTripCertificate;
