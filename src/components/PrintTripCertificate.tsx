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
  const daysWord =
    diffDays % 10 === 1 && diffDays % 100 !== 11
      ? 'день'
      : diffDays % 10 >= 2 && diffDays % 10 <= 4 && (diffDays % 100 < 10 || diffDays % 100 >= 20)
      ? 'дня'
      : 'дней';

  const orderDate = formatDate(trip.createdAt);
  const orderNumber = `${trip.id}-л/с`;
  const docYear = start.getFullYear() || new Date().getFullYear();

  const isApproved = trip.status === 'APPROVED' || trip.status === 'COMPLETED';

  return (
    <div
      ref={ref}
      style={{
        padding: '18px 28px',
        fontFamily: '"Times New Roman", Times, serif',
        color: '#000',
        backgroundColor: '#fff',
        width: '100%',
        maxWidth: '185mm',
        margin: '0 auto',
        boxSizing: 'border-box',
        fontSize: '12px',
        lineHeight: 1.3,
      }}
    >
      <style>{`@media print { @page { size: A4; margin: 10mm; } }`}</style>

      {/* Верхняя часть: Левая колонка (Штамп, дата, М.П.) + Правая колонка (Шапка и данные) */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: '18px', marginBottom: '18px' }}>
        {/* Левая колонка */}
        <div
          style={{
            width: '28%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            paddingTop: '52px',
            paddingBottom: '12px',
            textAlign: 'center',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: '11px', lineHeight: 1.25 }}>
            Штамп учреждения
            <br />
            (организации)
          </div>

          <div style={{ fontSize: '12px', marginTop: '30px' }}>
            от <span style={{ borderBottom: '1px solid #000', padding: '0 8px' }}>{orderDate}</span>
          </div>

          <div style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '40px' }}>
            М.П.
          </div>
        </div>

        {/* Правая колонка */}
        <div style={{ width: '72%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Шапка организации */}
          <div style={{ textAlign: 'center', marginBottom: '6px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '13.5px' }}>
              ТОО &quot;АЗИЯЭНЕРГОАВТОМАТИКА&quot;
            </div>
            <div style={{ fontSize: '11px', marginTop: '2px' }}>
              г. Алматы, ул. Бокейханова, 53а
            </div>
            <div style={{ fontSize: '11px' }}>
              тел.: 3862991, 2243162 факс: 3862994
            </div>
          </div>

          {/* Заголовок */}
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '13.5px', marginBottom: '8px' }}>
            КОМАНДИРОВОЧНОЕ УДОСТОВЕРЕНИЕ № {trip.id}
          </div>

          {/* Выдано (под линией) */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderBottom: '1px solid #000', paddingBottom: '2px', fontWeight: 500 }}>
              {trip.employee?.name || '________________________'}, {trip.employee?.title || 'специалист'}
            </div>
            <div style={{ fontSize: '10px', color: '#444', marginTop: '1px' }}>Выдано</div>
          </div>

          {/* командированному(й) в (под линией) */}
          <div style={{ textAlign: 'center', marginTop: '2px' }}>
            <div style={{ borderBottom: '1px solid #000', paddingBottom: '2px', fontWeight: 500 }}>
              {trip.destination}
            </div>
            <div style={{ fontSize: '10px', color: '#444', marginTop: '1px' }}>командированному(й) в</div>
          </div>

          {/* Срок командировки */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginTop: '4px' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ borderBottom: '1px solid #000', paddingBottom: '2px', fontWeight: 500 }}>
                {diffDays} {daysWord}
              </div>
              <div style={{ fontSize: '10px', color: '#444', marginTop: '1px' }}>Срок командировки</div>
            </div>
            <div style={{ width: '28%', textAlign: 'center' }}>
              <div style={{ borderBottom: '1px solid #000', paddingBottom: '2px', fontWeight: 500 }}>
                {formatDate(trip.startDate)}
              </div>
              <div style={{ fontSize: '10px', color: '#444', marginTop: '1px' }}>с</div>
            </div>
            <div style={{ width: '28%', textAlign: 'center' }}>
              <div style={{ borderBottom: '1px solid #000', paddingBottom: '2px', fontWeight: 500 }}>
                {formatDate(trip.endDate)}
              </div>
              <div style={{ fontSize: '10px', color: '#444', marginTop: '1px' }}>по</div>
            </div>
          </div>

          {/* Направляется для */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ whiteSpace: 'nowrap', fontSize: '11.5px' }}>Направляется для</span>
            <span style={{ borderBottom: '1px solid #000', flex: 1, paddingBottom: '1px', textAlign: 'center' }}>
              {trip.purpose || 'решения производственных вопросов'}
            </span>
          </div>

          {/* Основание */}
          <div style={{ marginTop: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ whiteSpace: 'nowrap', fontSize: '11.5px' }}>Основание: Приказ (распоряжение)</span>
              <span style={{ borderBottom: '1px solid #000', flex: 1, textAlign: 'center', paddingBottom: '1px' }}>
                О командировании
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginTop: '4px', paddingLeft: '65px' }}>
              <div style={{ textAlign: 'center', minWidth: '105px' }}>
                <div style={{ borderBottom: '1px solid #000', paddingBottom: '1px' }}>{orderDate}</div>
                <div style={{ fontSize: '10px', color: '#444' }}>от</div>
              </div>
              <div style={{ textAlign: 'center', minWidth: '85px' }}>
                <div style={{ borderBottom: '1px solid #000', paddingBottom: '1px', fontWeight: 500 }}>{orderNumber}</div>
                <div style={{ fontSize: '10px', color: '#444' }}>№</div>
              </div>
            </div>
          </div>

          {/* Действительно по предъявлению паспорта */}
          <div style={{ marginTop: '4px', fontSize: '11.5px', textAlign: 'center' }}>
            Действительно по предъявлению паспорта
          </div>
        </div>
      </div>

      {/* Подпись директора и печать */}
      <div style={{ position: 'relative', marginTop: '28px', marginBottom: '34px', paddingLeft: '28%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px', fontWeight: 'bold', paddingRight: '25px' }}>
          <span>Директор</span>
          <span>_______________________</span>
          <span>К.Ж. Быкаев</span>
        </div>

        {isApproved && (
          <div style={{ position: 'absolute', left: '47%', top: '-36px', opacity: 0.88, pointerEvents: 'none' }}>
            <img
              src={DIRECTOR_STAMP_SIGNATURE_DATA_URI}
              alt="Печать и подпись директора"
              style={{ width: '96px', height: '96px' }}
            />
          </div>
        )}
      </div>

      {/* Нижний блок: Отметки о выбытии и прибытии (без грубых черных рамок, как в бланке KomKsivf) */}
      <div style={{ marginTop: '18px' }}>
        <div style={{ fontSize: '11.5px', marginBottom: '14px', fontWeight: 'bold' }}>
          Отметка о выбытии в командировку, прибытии в пункты назначения и выбытии из них:
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <tbody>
            {[0, 1, 2, 3].map((rowIdx) => (
              <tr key={rowIdx}>
                <td style={{ padding: '10px 14px 8px 0', width: '50%', verticalAlign: 'top' }}>
                  <div>Выбыл из ___________________________________</div>
                  <div style={{ marginTop: '10px' }}>
                    Подпись ___________ &nbsp; &quot;____&quot; ___________ {docYear} г.
                  </div>
                  <div style={{ marginTop: '5px', textAlign: 'center', fontSize: '10px', color: '#444' }}>
                    печать
                  </div>
                </td>
                <td style={{ padding: '10px 0 8px 14px', width: '50%', verticalAlign: 'top' }}>
                  <div>Прибыл в __________________________________</div>
                  <div style={{ marginTop: '10px' }}>
                    Подпись ___________ &nbsp; &quot;____&quot; __________ {docYear} г.
                  </div>
                  <div style={{ marginTop: '5px', textAlign: 'center', fontSize: '10px', color: '#444' }}>
                    печать
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Примечание */}
      <div style={{ marginTop: '12px', fontSize: '10.5px' }}>
        <strong>Примечание:</strong> при выезде в несколько пунктов отметки о прибытии и выбытии делаются отдельно в каждом из них.
      </div>
    </div>
  );
});

PrintTripCertificate.displayName = 'PrintTripCertificate';
export default PrintTripCertificate;
