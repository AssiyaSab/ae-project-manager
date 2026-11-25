import imageCompression from 'browser-image-compression';

export async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file;
  }
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.3,
      maxWidthOrHeight: 1600,
      initialQuality: 0.75,
      useWebWorker: true,
    });
    return compressed;
  } catch (err) {
    console.warn('Image compression failed, using original file:', err);
    return file;
  }
}

export async function fileToCompressedDataUrl(file: File): Promise<string> {
  const processed = await compressImageIfNeeded(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(processed);
  });
}
