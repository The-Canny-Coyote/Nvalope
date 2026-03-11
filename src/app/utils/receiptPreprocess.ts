/**
 * Canvas preprocessing for receipt images before OCR: improves Tesseract accuracy.
 * Grayscale → contrast 150% → threshold → resize (max 1024×768, aspect preserved).
 */

const MAX_WIDTH = 1024;
const MAX_HEIGHT = 768;
const CONTRAST_FACTOR = 1.5;
const THRESHOLD = 128;

/**
 * Preprocess an image (file or data URL) for receipt OCR.
 * Returns a data URL (JPEG) suitable for Tesseract.recognize().
 */
export function preprocessReceiptImage(source: File | string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const scale = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2d not available'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const contrasted = (gray - 128) * CONTRAST_FACTOR + 128;
          const v = contrasted < THRESHOLD ? 0 : 255;
          data[i] = data[i + 1] = data[i + 2] = v;
        }
        ctx.putImageData(imageData, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        resolve(dataUrl);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('Image load failed'));
    if (typeof source === 'string') {
      img.src = source;
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(source);
    }
  });
}
