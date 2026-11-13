import React, { forwardRef } from 'react';

interface PrintPurchaseRequestProps {
  purchase: any;
}

const PrintPurchaseRequest = forwardRef<HTMLDivElement, PrintPurchaseRequestProps>(({ purchase }, ref) => {
  if (!purchase) return null;

  const creationDate = new Date(purchase.createdAt);
  const day = String(creationDate.getDate()).padStart(2, '0');
  const monthStr = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'][creationDate.getMonth()];
  const year = creationDate.getFullYear();

  const isApproved = [
    'IN_PROCUREMENT',
    'PENDING_PAYMENT_APPROVAL',
    'APPROVED_FOR_PAYMENT',
    'PAID_AND_ORDERED',
    'POA_ISSUED',
    'IN_TRANSIT',
    'DELIVERED',
    'APPROVED',
    'PAID',
    'PAID_EXPENSE',
  ].includes(purchase.status);

  return (
    <div ref={ref} style={{ padding: '40px', fontFamily: '"Times New Roman", Times, serif', color: '#000', backgroundColor: '#fff', width: '210mm', minHeight: '297mm', boxSizing: 'border-box' }}>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '30px' }}>
        <div style={{ width: '320px', textAlign: 'right' }}>
          <div style={{ fontWeight: 'bold' }}>Директору</div>
          <div style={{ fontWeight: 'bold' }}>ТОО «АзияЭнергоАвтоматика»</div>
          <div style={{ fontWeight: 'bold' }}>Быкаеву Канату Женисовичу</div>
          <div style={{ marginTop: '10px' }}>от <span style={{ textDecoration: 'underline' }}>{purchase.requester?.name || 'Руководитель проекта (Администрация)'}</span></div>
          <div style={{ fontSize: '10px', textAlign: 'center', marginTop: '2px', marginRight: '50px' }}>(ФИО)</div>
          <div style={{ marginTop: '5px' }}><span style={{ textDecoration: 'underline' }}>{purchase.requester?.title || 'ГИП / Администрация ТОО'}</span></div>
          <div style={{ fontSize: '10px', textAlign: 'center', marginTop: '2px', marginRight: '50px' }}>(должность)</div>
          <div style={{ marginTop: '10px' }}>« {day} » {monthStr} {year} г.</div>
        </div>
      </div>

      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '18px', marginBottom: '25px' }}>
        ЗАЯВКА<br/>
        {purchase.type === 'EXPENSE' ? 'на подотчетные расходы (чек)' : 'на закупку ТМЦ (счет на оплату)'}
      </div>

      <div style={{ marginBottom: '15px', lineHeight: '1.5' }}>
        В связи с: <span style={{ textDecoration: 'underline' }}>{purchase.title} {purchase.project ? `(Проект: ${purchase.project.name})` : ''}</span>
      </div>

      {purchase.supplierName && (
        <div style={{ marginBottom: '15px', padding: '10px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '13px' }}>
          <div><strong>Поставщик:</strong> {purchase.supplierName}</div>
          {purchase.invoiceNumber && <div><strong>Счет на оплату:</strong> № {purchase.invoiceNumber} {purchase.invoiceDate ? `от ${new Date(purchase.invoiceDate).toLocaleDateString('ru-RU')}` : ''}</div>}
          {purchase.plannedDeliveryDate && <div><strong>Срок поставки:</strong> до {new Date(purchase.plannedDeliveryDate).toLocaleDateString('ru-RU')}</div>}
          {purchase.supplyComment && <div><strong>Условия снабжения:</strong> {purchase.supplyComment}</div>}
        </div>
      )}

      <div style={{ marginBottom: '10px' }}>
        Прошу оплатить следующие расходы:
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', border: '1px solid #000' }}>
        {purchase.items && purchase.items.length > 0 ? (
          <>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', fontSize: '12px' }}>
                <th style={{ border: '1px solid #000', padding: '6px', width: '35px', textAlign: 'center' }}>№</th>
                <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'left' }}>Наименование и характеристики ТМЦ</th>
                <th style={{ border: '1px solid #000', padding: '6px', width: '70px', textAlign: 'center' }}>Кол-во</th>
                <th style={{ border: '1px solid #000', padding: '6px', width: '55px', textAlign: 'center' }}>Ед.</th>
                <th style={{ border: '1px solid #000', padding: '6px', width: '90px', textAlign: 'right' }}>Цена (₸)</th>
                <th style={{ border: '1px solid #000', padding: '6px', width: '105px', textAlign: 'right' }}>Сумма (₸)</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '12px' }}>
              {purchase.items.map((item: any, idx: number) => {
                const itemTotal = item.total > 0 ? item.total : (item.price > 0 ? item.price * item.quantity : 0);
                return (
                  <tr key={item.id || idx}>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ border: '1px solid #000', padding: '6px' }}>{item.name}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{item.quantity}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{item.unit || 'шт'}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>
                      {item.price > 0 ? item.price.toLocaleString('ru-RU') : '—'}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>
                      {itemTotal > 0 ? itemTotal.toLocaleString('ru-RU') : '—'}
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td colSpan={5} style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>
                  Итого по заявке:
                </td>
                <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>
                  {(purchase.amount || 0).toLocaleString('ru-RU')} ₸
                </td>
              </tr>
            </tbody>
          </>
        ) : (
          <>
            <thead>
              <tr>
                <th style={{ border: '1px solid #000', padding: '8px', width: '50px' }}>№ п/п</th>
                <th style={{ border: '1px solid #000', padding: '8px' }}>Наименование / Расходы</th>
                <th style={{ border: '1px solid #000', padding: '8px', width: '150px' }}>Сумма (KZT)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>1</td>
                <td style={{ border: '1px solid #000', padding: '8px' }}>
                  {purchase.title}
                  {purchase.supplierName ? ` (Поставщик: ${purchase.supplierName})` : ''}
                </td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                  {(purchase.amount || 0).toLocaleString('ru-RU')}
                </td>
              </tr>
              <tr>
                <td colSpan={2} style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>Общая сумма:</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                  {(purchase.amount || 0).toLocaleString('ru-RU')} ₸
                </td>
              </tr>
            </tbody>
          </>
        )}
      </table>

      {/* Приложение / Ссылка на спецификацию/Google Диск */}
      {purchase.fileUrl && (
        <div style={{ marginTop: '15px', marginBottom: '25px', padding: '8px 12px', background: '#f8fafc', border: '1px dashed #94a3b8', fontSize: '11px', color: '#334155' }}>
          <strong>Приложение:</strong> Спецификация / Каталог ТМЦ:
          <div style={{ marginTop: '4px', wordBreak: 'break-all', color: '#1d4ed8' }}>
            {purchase.fileUrl}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '35px', marginTop: '40px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          Согласовано: __________________ / Быкаев К.Ж. /
          {isApproved && (
            <img src="/images/signature.png" alt="Signature" style={{ width: '120px', height: '60px', position: 'absolute', left: '105px', top: '-18px', opacity: 0.9 }} />
          )}
        </div>
        <div>
          Выдано / Оплачено: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; __________________ / __________________ /
        </div>
      </div>

    </div>
  );
});

PrintPurchaseRequest.displayName = 'PrintPurchaseRequest';
export default PrintPurchaseRequest;
