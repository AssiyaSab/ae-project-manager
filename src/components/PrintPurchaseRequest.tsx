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

  const isApproved = ['APPROVED_FOR_PAYMENT', 'PAID_AND_ORDERED', 'DELIVERED', 'APPROVED', 'PAID'].includes(purchase.status);

  return (
    <div ref={ref} style={{ padding: '40px', fontFamily: '"Times New Roman", Times, serif', color: '#000', backgroundColor: '#fff', width: '210mm', minHeight: '297mm', boxSizing: 'border-box' }}>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '30px' }}>
        <div style={{ width: '320px', textAlign: 'right' }}>
          <div style={{ fontWeight: 'bold' }}>Директору</div>
          <div style={{ fontWeight: 'bold' }}>ТОО «АзияЭнергоАвтоматика»</div>
          <div style={{ fontWeight: 'bold' }}>Быкаеву Канату Женисовичу</div>
          <div style={{ marginTop: '10px' }}>от <span style={{ textDecoration: 'underline' }}>{purchase.requester?.name || '________________________'}</span></div>
          <div style={{ fontSize: '10px', textAlign: 'center', marginTop: '2px', marginRight: '50px' }}>(ФИО)</div>
          <div style={{ marginTop: '5px' }}><span style={{ textDecoration: 'underline' }}>{purchase.requester?.title || '________________________'}</span></div>
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

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px', border: '1px solid #000' }}>
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
              {(purchase.amount || 0).toLocaleString('ru-RU')}
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '35px', marginTop: '40px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          Согласовано: __________________ / Быкаев К.Ж. /
          {isApproved && (
            <img src="/images/signature.png" alt="Signature" style={{ width: '120px', height: '60px', position: 'absolute', left: '150px', top: '-10px', opacity: 0.9 }} />
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
