import React, { forwardRef } from 'react';
import { formatDate } from '@/lib/formatters';
import { numberToWordsKzt } from '@/lib/numberToWordsRu';

export interface PrintSaleInvoiceProps {
  order: any;
}

const PrintSaleInvoice = forwardRef<HTMLDivElement, PrintSaleInvoiceProps>(({ order }, ref) => {
  if (!order) return null;

  const invoiceDate = order.invoiceDate ? new Date(order.invoiceDate) : new Date(order.createdAt);
  const day = String(invoiceDate.getDate()).padStart(2, '0');
  const monthNames = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];
  const monthStr = monthNames[invoiceDate.getMonth()];
  const year = invoiceDate.getFullYear();

  const totalAmount = Number(order.totalAmount) || 0;
  const vatRate = Number(order.vatRate) || 16;
  const vatAmount = Number(order.vatAmount) || Math.round((totalAmount * vatRate) / (100 + vatRate) * 100) / 100;
  const subtotal = Math.round((totalAmount - vatAmount) * 100) / 100;

  const items = order.items && order.items.length > 0 ? order.items : [];

  return (
    <div
      ref={ref}
      style={{
        padding: '30px 40px',
        fontFamily: '"Times New Roman", Times, serif',
        color: '#000',
        backgroundColor: '#fff',
        width: '210mm',
        minHeight: '297mm',
        boxSizing: 'border-box',
        fontSize: '12px',
        lineHeight: 1.3,
      }}
    >
      {/* 1. Верхний блок с логотипом и шапкой */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <img src="/images/logo.png" alt="AsiaEnergoAutomatika Logo" style={{ width: '130px', height: 'auto' }} />
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>ТОО «АзияЭнергоАвтоматика»</div>
            <div style={{ fontSize: '11px', color: '#333' }}>Поставка электрооборудования ONKA и WEG в Республике Казахстан</div>
            <div style={{ fontSize: '10px', color: '#555' }}>Свидетельство НДС №0072706 Серия 60001 от 23.02.2015г.</div>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '11px', color: '#555' }}>
          <div>г. Алматы, ул. Бокейханова, 53а, 050014</div>
          <div>тел/факс: +7 (727) 224-31-62, 386-29-94</div>
          <div>office@ae-automation.kz</div>
        </div>
      </div>

      <div style={{ fontSize: '11px', marginBottom: '8px', fontStyle: 'italic', color: '#444' }}>
        Внимание! Оплата данного счета означает согласие с условиями поставки товара. Уведомление об оплате обязательно.
      </div>

      {/* 2. Банковские реквизиты поставщика (Образец заполнения платежного поручения) */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: '20px', fontSize: '11px' }}>
        <tbody>
          <tr>
            <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 8px', verticalAlign: 'top', width: '65%' }}>
              АО «Alatau City Bank»<br />
              <span style={{ fontSize: '9px', color: '#666' }}>Банк получателя</span>
            </td>
            <td style={{ border: '1px solid #000', padding: '4px 8px', verticalAlign: 'top', width: '15%' }}>
              <strong>БИК</strong>
            </td>
            <td style={{ border: '1px solid #000', padding: '4px 8px', verticalAlign: 'top', width: '20%' }}>
              TSESKZKA
            </td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #000', padding: '4px 8px', width: '32%' }}>
              <strong>БИН</strong> 150140009432 &nbsp;|&nbsp; <strong>РНН</strong> 600500610307
            </td>
            <td style={{ border: '1px solid #000', padding: '4px 8px', width: '33%' }}>
              <strong>Кбе</strong> 17
            </td>
            <td style={{ border: '1px solid #000', padding: '4px 8px' }}>
              <strong>Счет № (ИИК)</strong>
            </td>
            <td style={{ border: '1px solid #000', padding: '4px 8px', fontWeight: 'bold' }}>
              KZ39998CTB0000477153
            </td>
          </tr>
          <tr>
            <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 8px' }}>
              ТОО «АзияЭнергоАвтоматика»<br />
              <span style={{ fontSize: '9px', color: '#666' }}>Получатель (Свид. НДС №0072706 Серия 60001 от 23.02.2015г.)</span>
            </td>
            <td style={{ border: '1px solid #000', padding: '4px 8px' }}>
              <strong>Код назн. (КНП)</strong>
            </td>
            <td style={{ border: '1px solid #000', padding: '4px 8px' }}>
              710
            </td>
          </tr>
        </tbody>
      </table>

      {/* 3. Заголовок счета */}
      <div style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '16px', marginBottom: '15px', borderBottom: '2px solid #000', paddingBottom: '6px' }}>
        Счет на оплату № {order.orderNumber} от «{day}» {monthStr} {year} г.
      </div>

      {/* 4. Поставщик и Покупатель */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px', fontSize: '11px' }}>
        <tbody>
          <tr>
            <td style={{ width: '100px', fontWeight: 'bold', verticalAlign: 'top', padding: '3px 0' }}>Поставщик:</td>
            <td style={{ verticalAlign: 'top', padding: '3px 0' }}>
              <strong>ТОО «АзияЭнергоАвтоматика»</strong>, БИН: 150140009432, РНН: 600500610307, г. Алматы, ул. Бокейханова, 53а, 050014, тел: +7 (727) 224-31-62, 386-29-94, email: office@ae-automation.kz
            </td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold', verticalAlign: 'top', padding: '3px 0' }}>Покупатель:</td>
            <td style={{ verticalAlign: 'top', padding: '3px 0' }}>
              <strong>{order.customerName}</strong>
              {order.customerBin ? `, БИН/ИИН: ${order.customerBin}` : ''}
              {order.customerAddress ? `, адрес: ${order.customerAddress}` : ''}
              {order.customerPhone ? `, тел: ${order.customerPhone}` : ''}
            </td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold', verticalAlign: 'top', padding: '3px 0' }}>Основание:</td>
            <td style={{ verticalAlign: 'top', padding: '3px 0' }}>
              Основной договор / Заказ на поставку оборудования ({order.brand || 'ONKA / WEG'})
            </td>
          </tr>
        </tbody>
      </table>

      {/* 5. Табличная часть с товарами */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: '15px', fontSize: '11px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f1f5f9' }}>
            <th style={{ border: '1px solid #000', padding: '6px 4px', width: '30px', textAlign: 'center' }}>№</th>
            <th style={{ border: '1px solid #000', padding: '6px 6px', width: '70px', textAlign: 'center' }}>Бренд</th>
            <th style={{ border: '1px solid #000', padding: '6px 6px', width: '100px', textAlign: 'left' }}>Артикул</th>
            <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'left' }}>Товары (работы, услуги)</th>
            <th style={{ border: '1px solid #000', padding: '6px 4px', width: '50px', textAlign: 'center' }}>Кол-во</th>
            <th style={{ border: '1px solid #000', padding: '6px 4px', width: '40px', textAlign: 'center' }}>Ед.</th>
            <th style={{ border: '1px solid #000', padding: '6px 6px', width: '85px', textAlign: 'right' }}>Цена (₸)</th>
            <th style={{ border: '1px solid #000', padding: '6px 6px', width: '95px', textAlign: 'right' }}>Сумма (₸)</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it: any, idx: number) => (
            <tr key={it.id || idx}>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{idx + 1}</td>
              <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', fontWeight: 'bold' }}>{it.brand || 'ONKA'}</td>
              <td style={{ border: '1px solid #000', padding: '4px 6px', fontFamily: 'monospace' }}>{it.article || '-'}</td>
              <td style={{ border: '1px solid #000', padding: '4px 8px' }}>{it.name}</td>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{Number(it.quantity).toLocaleString('ru-RU')}</td>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{it.unit || 'шт'}</td>
              <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{Number(it.price).toLocaleString('ru-RU')}</td>
              <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>{Number(it.total).toLocaleString('ru-RU')}</td>
            </tr>
          ))}

          {/* Итоги */}
          <tr>
            <td colSpan={6} style={{ border: 'none', borderRight: '1px solid #000' }}></td>
            <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>Итого без НДС:</td>
            <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>{subtotal.toLocaleString('ru-RU')}</td>
          </tr>
          <tr>
            <td colSpan={6} style={{ border: 'none', borderRight: '1px solid #000' }}></td>
            <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>В т.ч. НДС ({vatRate}%):</td>
            <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>{vatAmount.toLocaleString('ru-RU')}</td>
          </tr>
          <tr style={{ backgroundColor: '#f8fafc' }}>
            <td colSpan={6} style={{ border: 'none', borderRight: '1px solid #000' }}></td>
            <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', fontWeight: 'bold', fontSize: '12px' }}>Всего к оплате:</td>
            <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', fontWeight: 'bold', fontSize: '12px' }}>{totalAmount.toLocaleString('ru-RU')} ₸</td>
          </tr>
        </tbody>
      </table>

      {/* 6. Сумма прописью */}
      <div style={{ marginBottom: '15px', fontSize: '11px' }}>
        Всего наименований {items.length}, на сумму <strong>{totalAmount.toLocaleString('ru-RU')} KZT</strong><br />
        <strong>Сумма прописью: {numberToWordsKzt(totalAmount)}</strong>
      </div>

      <div style={{ borderTop: '1px solid #666', margin: '20px 0 15px 0' }} />

      {/* 7. Подписи и факсимиле печати */}
      <div style={{ position: 'relative', marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px' }}>
          <div style={{ width: '48%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span>Руководитель:</span>
              <span style={{ textDecoration: 'underline' }}>Директор Быкаев К.Ж. (на основании Устава)</span>
            </div>
            <div style={{ fontSize: '9px', textAlign: 'center', color: '#666' }}>(подпись / расшифровка)</div>
          </div>
          <div style={{ width: '48%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span>Бухгалтер:</span>
              <span style={{ textDecoration: 'underline' }}>Быкаев К.Ж.</span>
            </div>
            <div style={{ fontSize: '9px', textAlign: 'center', color: '#666' }}>(подпись / расшифровка)</div>
          </div>
        </div>

        {/* Факсимиле круглой синей печати директора */}
        <div style={{ position: 'absolute', left: '120px', top: '-25px', opacity: 0.88, pointerEvents: 'none' }}>
          <img src="/images/stamp_signature.png" alt="Печать и подпись" style={{ width: '155px', height: '155px' }} />
        </div>

        <div style={{ fontSize: '10px', color: '#666', marginTop: '40px' }}>
          * Отгрузка товара со склада осуществляется строго при наличии оригинала Доверенности и документа, удостоверяющего личность получателя.
        </div>
      </div>
    </div>
  );
});

PrintSaleInvoice.displayName = 'PrintSaleInvoice';
export default PrintSaleInvoice;
