import React, { forwardRef } from 'react';
import { formatDate } from '@/lib/formatters';

interface PrintToolActProps {
  log: any; // expects tool.logs[0] joined with tool
  tool: any;
}

const PrintToolAct = forwardRef<HTMLDivElement, PrintToolActProps>(({ log, tool }, ref) => {
  if (!log || !tool) return null;

  return (
    <div ref={ref} style={{ padding: '40px', fontFamily: '"Times New Roman", Times, serif', color: '#000', backgroundColor: '#fff', width: '210mm', minHeight: '297mm', boxSizing: 'border-box' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px', alignItems: 'flex-start' }}>
        <div>
          <img src="/images/logo.png" alt="Logo" style={{ width: '150px' }} />
        </div>
        <div style={{ textAlign: 'right', fontWeight: 'bold' }}>
          <div>г. Алматы</div>
          <div>ТОО «АзияЭнергоАвтоматика»</div>
        </div>
      </div>

      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '18px', marginBottom: '20px' }}>
        АКТ ПРИЕМА-ПЕРЕДАЧИ ИНСТРУМЕНТА И ОБОРУДОВАНИЯ № {log.id}
      </div>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        Дата: {formatDate(log.issueDate)}
      </div>

      <div style={{ marginBottom: '20px', textAlign: 'justify', lineHeight: '1.5' }}>
        Настоящий акт составлен о том, что Склад передал, а нижеподписавшийся сотрудник <b>{log.employee?.name}</b> принял в подотчет для выполнения работ по проекту <b>{log.project?.name || '______________________'}</b> следующий инструмент:
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px', border: '1px solid #000' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #000', padding: '8px', width: '40px' }}>№</th>
            <th style={{ border: '1px solid #000', padding: '8px' }}>Наименование инструмента</th>
            <th style={{ border: '1px solid #000', padding: '8px' }}>Серийный / Инв. №</th>
            <th style={{ border: '1px solid #000', padding: '8px' }}>Состояние при выдаче</th>
            <th style={{ border: '1px solid #000', padding: '8px' }}>Примечание</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>1</td>
            <td style={{ border: '1px solid #000', padding: '8px' }}>{tool.name}</td>
            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{tool.serialNumber || '-'}</td>
            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>Исправен</td>
            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{log.project?.name || ''}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginBottom: '50px', textAlign: 'justify', lineHeight: '1.5' }}>
        Сотрудник обязуется бережно обращаться с вверенным имуществом и вернуть его по первому требованию или по завершении работ.
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
        <div>
          Сдал (Кладовщик): ____________________ / _______________
        </div>
        
        <div style={{ position: 'absolute', left: '10%', top: '-30px', opacity: 0.85 }}>
          <img src="/images/stamp_signature.png" alt="Stamp" style={{ width: '150px', height: '150px' }} />
        </div>

        <div>
          Принял (Сотрудник): __________________ / _______________
        </div>
      </div>
    </div>
  );
});

PrintToolAct.displayName = 'PrintToolAct';
export default PrintToolAct;

