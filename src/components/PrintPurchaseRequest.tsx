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

  return (
    <div ref={ref} style={{ padding: '40px', fontFamily: '"Times New Roman", Times, serif', color: '#000', backgroundColor: '#fff', width: '210mm', minHeight: '297mm', boxSizing: 'border-box' }}>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '40px' }}>
        <div style={{ width: '300px', textAlign: 'right' }}>
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

      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '18px', marginBottom: '30px' }}>
        ЗАЯВКА<br/>
        на расходы
      </div>

      <div style={{ marginBottom: '20px' }}>
        В связи с <span style={{ textDecoration: 'underline' }}>{purchase.title} {purchase.project ? `(Проект: ${purchase.project.name})` : ''}</span>
      </div>

      <div style={{ marginBottom: '10px' }}>
        Прошу оплатить следующие расходы:
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px', border: '1px solid #000' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #000', padding: '8px', width: '50px' }}>№ п/п</th>
            <th style={{ border: '1px solid #000', padding: '8px' }}>расходы</th>
            <th style={{ border: '1px solid #000', padding: '8px', width: '150px' }}>Сумма</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>1</td>
            <td style={{ border: '1px solid #000', padding: '8px' }}>{purchase.title}</td>
            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{purchase.amount.toLocaleString('ru-RU')}</td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>2</td>
            <td style={{ border: '1px solid #000', padding: '8px' }}></td>
            <td style={{ border: '1px solid #000', padding: '8px' }}></td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>3</td>
            <td style={{ border: '1px solid #000', padding: '8px' }}></td>
            <td style={{ border: '1px solid #000', padding: '8px' }}></td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>4</td>
            <td style={{ border: '1px solid #000', padding: '8px' }}></td>
            <td style={{ border: '1px solid #000', padding: '8px' }}></td>
          </tr>
          <tr>
            <td colSpan={2} style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>Общая сумма расходов:</td>
            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{purchase.amount.toLocaleString('ru-RU')}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', marginTop: '50px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          Согласовано: __________________ / __________________ /
          {(purchase.status === 'APPROVED' || purchase.status === 'PAID') && (
            <img src="/images/signature.png" alt="Signature" style={{ width: '120px', height: '60px', position: 'absolute', left: '150px', top: '-10px', opacity: 0.9 }} />
          )}
        </div>
        <div>
          Выдано: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; __________________ / __________________ /
        </div>
      </div>

    </div>
  );
});

PrintPurchaseRequest.displayName = 'PrintPurchaseRequest';
export default PrintPurchaseRequest;
