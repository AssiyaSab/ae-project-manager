'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { stampImageBlob, stampPdfBytes } from '@/lib/stampInvoice';

export function formatTelegramOrFileUrl(url?: string | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/api/') || trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  return `/api/files/telegram/${encodeURIComponent(trimmed)}`;
}

export interface ApprovalStampInfo {
  approvedBy: string;
  date?: string;
}

interface FilePreviewModalProps {
  file: {
    url: string;
    title: string;
    approvalStamp?: ApprovalStampInfo | null;
  } | null;
  onClose: () => void;
}

export default function FilePreviewModal({ file, onClose }: FilePreviewModalProps) {
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [mimeType, setMimeType] = useState<string>('');
  const [embeddedStampApplied, setEmbeddedStampApplied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const printAreaRef = useRef<HTMLDivElement>(null);

  const handlePrintWithStamp = useReactToPrint({
    contentRef: printAreaRef,
    documentTitle: file?.title || 'Document',
  });

  useEffect(() => {
    if (!file) return;
    let active = true;
    let createdObjectUrl = '';

    const load = async () => {
      const normalized = formatTelegramOrFileUrl(file.url);
      setEmbeddedStampApplied(false);
      setError('');

      // If no approvalStamp and external/data URL, show directly without fetching
      if (!file.approvalStamp) {
        if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
          setBlobUrl(normalized);
          setMimeType(normalized.toLowerCase().includes('.pdf') ? 'application/pdf' : 'image/*');
          return;
        }
        if (normalized.startsWith('data:')) {
          setBlobUrl(normalized);
          const m = normalized.match(/^data:([^;]+);/);
          setMimeType(m ? m[1] : 'application/octet-stream');
          return;
        }
      }

      setLoading(true);
      try {
        const isInternalApi = normalized.startsWith('/api/');
        const pass = typeof window !== 'undefined' ? localStorage.getItem('ae_admin_password') || '' : '';
        const login = typeof window !== 'undefined' ? localStorage.getItem('ae_auth_login') || '' : '';

        const res = await fetch(
          normalized,
          isInternalApi
            ? {
                headers: {
                  'x-admin-password': pass,
                  'x-auth-password': pass,
                  'x-auth-login': login,
                },
              }
            : undefined
        );
        if (!res.ok) {
          throw new Error('Не удалось загрузить файл');
        }
        let blob = await res.blob();
        let finalMime = blob.type || (normalized.toLowerCase().includes('.pdf') ? 'application/pdf' : 'application/octet-stream');

        if (file.approvalStamp) {
          try {
            if (finalMime.includes('pdf') || normalized.toLowerCase().includes('.pdf')) {
              blob = await stampPdfBytes(await blob.arrayBuffer(), file.approvalStamp);
              finalMime = 'application/pdf';
              if (active) setEmbeddedStampApplied(true);
            } else if (finalMime.startsWith('image/')) {
              blob = await stampImageBlob(blob, file.approvalStamp);
              finalMime = 'image/png';
              if (active) setEmbeddedStampApplied(true);
            }
          } catch (stampErr) {
            console.warn('Could not embed stamp directly into file, showing HTML overlay fallback:', stampErr);
          }
        }

        if (!active) return;
        createdObjectUrl = URL.createObjectURL(blob);
        setBlobUrl(createdObjectUrl);
        setMimeType(finalMime);
      } catch (err: any) {
        // Fallback for external URLs blocked by CORS
        if (active && (normalized.startsWith('http://') || normalized.startsWith('https://'))) {
          setBlobUrl(normalized);
          setMimeType(normalized.toLowerCase().includes('.pdf') ? 'application/pdf' : 'image/*');
        } else if (active) {
          setError(err?.message || 'Ошибка загрузки файла');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
      if (createdObjectUrl) URL.revokeObjectURL(createdObjectUrl);
    };
  }, [file]);

  if (!file) return null;

  const isPdf = mimeType.includes('pdf');
  const isImage = mimeType.startsWith('image/');

  const renderFallbackHtmlStamp = () => {
    if (!file.approvalStamp || embeddedStampApplied) return null;
    return (
      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
        <div
          style={{
            border: '2.5px solid #047857',
            borderRadius: '8px',
            padding: '8px 14px',
            color: '#047857',
            background: 'rgba(236, 253, 245, 0.96)',
            fontFamily: 'Arial, sans-serif',
            textAlign: 'center',
            lineHeight: 1.35,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: '0.82rem', letterSpacing: '0.8px' }}>
            ОДОБРЕНО ДИРЕКТОРОМ
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', marginTop: '2px' }}>
            {file.approvalStamp.approvedBy}
          </div>
          {file.approvalStamp.date && (
            <div style={{ fontSize: '0.72rem', marginTop: '2px', opacity: 0.9 }}>
              Дата: {file.approvalStamp.date}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200, padding: '16px' }}>
      <div className="form-card" style={{ width: '880px', maxWidth: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '10px', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>{file.title}</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {blobUrl && file.approvalStamp && isImage && (
              <button
                type="button"
                onClick={() => handlePrintWithStamp()}
                className="inline-btn"
                style={{ background: '#059669', color: '#fff', fontWeight: 600 }}
              >
                🖨️ Печать со штампом
              </button>
            )}
            {blobUrl && (
              <>
                <a href={blobUrl} target="_blank" rel="noreferrer" className="inline-btn" style={{ background: '#3b82f6', color: '#fff', textDecoration: 'none' }}>
                  🔗 В новой вкладке
                </a>
                <a href={blobUrl} download={isPdf ? 'schet_odobreno.pdf' : 'schet_odobreno.png'} className="inline-btn" style={{ background: '#10b981', color: '#fff', textDecoration: 'none' }}>
                  📥 Скачать
                </a>
              </>
            )}
            <button type="button" onClick={onClose} className="inline-btn" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
              ✕ Закрыть
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: '420px', maxHeight: '76vh', overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#020617', borderRadius: '8px', padding: '12px' }}>
          {loading && <div style={{ color: 'var(--text-muted)' }}>⏳ Загрузка и наложение штампа...</div>}
          {error && <div style={{ color: '#f87171' }}>⚠️ {error}</div>}
          {!loading && !error && blobUrl && (
            <div ref={printAreaRef} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {isPdf && (
                <iframe src={blobUrl} style={{ width: '100%', height: '70vh', border: 'none', borderRadius: '6px', background: '#fff' }} title={file.title} />
              )}
              {isImage && (
                <img src={blobUrl} alt={file.title} style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '6px' }} />
              )}
              {!isPdf && !isImage && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  <p>Предпросмотр для этого типа файла недоступен в браузере.</p>
                  <a href={blobUrl} download className="btn-submit" style={{ textDecoration: 'none', display: 'inline-block' }}>
                    📥 Скачать файл
                  </a>
                </div>
              )}
              {renderFallbackHtmlStamp()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
