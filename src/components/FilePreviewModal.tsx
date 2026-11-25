'use client';

import React, { useEffect, useState } from 'react';

export function formatTelegramOrFileUrl(url?: string | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/api/') || trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  return `/api/files/telegram/${encodeURIComponent(trimmed)}`;
}

interface FilePreviewModalProps {
  file: { url: string; title: string } | null;
  onClose: () => void;
}

export default function FilePreviewModal({ file, onClose }: FilePreviewModalProps) {
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [mimeType, setMimeType] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!file) return;
    let active = true;
    let createdObjectUrl = '';

    const load = async () => {
      const normalized = formatTelegramOrFileUrl(file.url);
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

      setLoading(true);
      setError('');
      try {
        const pass = typeof window !== 'undefined' ? localStorage.getItem('ae_admin_password') || '' : '';
        const login = typeof window !== 'undefined' ? localStorage.getItem('ae_auth_login') || '' : '';
        const res = await fetch(normalized, {
          headers: {
            'x-admin-password': pass,
            'x-auth-password': pass,
            'x-auth-login': login,
          },
        });
        if (!res.ok) {
          throw new Error('Не удалось загрузить файл');
        }
        const blob = await res.blob();
        if (!active) return;
        createdObjectUrl = URL.createObjectURL(blob);
        setBlobUrl(createdObjectUrl);
        setMimeType(blob.type || 'application/octet-stream');
      } catch (err: any) {
        if (active) setError(err?.message || 'Ошибка загрузки файла');
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

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200, padding: '16px' }}>
      <div className="form-card" style={{ width: '880px', maxWidth: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '10px', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>{file.title}</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            {blobUrl && (
              <>
                <a href={blobUrl} target="_blank" rel="noreferrer" className="inline-btn" style={{ background: '#3b82f6', color: '#fff', textDecoration: 'none' }}>
                  🔗 В новой вкладке
                </a>
                <a href={blobUrl} download className="inline-btn" style={{ background: '#10b981', color: '#fff', textDecoration: 'none' }}>
                  📥 Скачать
                </a>
              </>
            )}
            <button type="button" onClick={onClose} className="inline-btn" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
              ✕ Закрыть
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: '420px', maxHeight: '75vh', overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#020617', borderRadius: '8px', padding: '10px' }}>
          {loading && <div style={{ color: 'var(--text-muted)' }}>⏳ Загрузка файла из Telegram...</div>}
          {error && <div style={{ color: '#f87171' }}>⚠️ {error}</div>}
          {!loading && !error && blobUrl && isPdf && (
            <iframe src={blobUrl} style={{ width: '100%', height: '70vh', border: 'none', borderRadius: '6px' }} title={file.title} />
          )}
          {!loading && !error && blobUrl && isImage && (
            <img src={blobUrl} alt={file.title} style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '6px' }} />
          )}
          {!loading && !error && blobUrl && !isPdf && !isImage && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              <p>Предпросмотр для этого типа файла недоступен в браузере.</p>
              <a href={blobUrl} download className="btn-submit" style={{ textDecoration: 'none', display: 'inline-block' }}>
                📥 Скачать файл
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
