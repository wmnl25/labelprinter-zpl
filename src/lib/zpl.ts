import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Use local worker from pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface ZplResult {
  zpl: string;
  previewUrl: string;
  width: number;
  height: number;
}

/**
 * Process a File (PDF or Image) to ZPL.
 * 1. Render to Canvas
 * 2. Auto-trim whitespace
 * 3. Rotate to portrait if needed
 * 4. Scale to 4x6 (812x1218 at 203 DPI)
 * 5. Convert to ZPL graphic field
 */
export async function processFileToZPL(file: File): Promise<ZplResult> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  if (file.type === 'application/pdf') {
    await renderPDFToCanvas(file, canvas, ctx);
  } else if (file.type.startsWith('image/')) {
    await renderImageToCanvas(file, canvas, ctx);
  } else {
    throw new Error('Unsupported file type. Please upload a PDF or an image.');
  }

  const trimmedCanvas = trimCanvas(canvas);
  const rotatedCanvas = rotateCanvasIfNeeded(trimmedCanvas);
  
  // 4x6 inches at 203 DPI (8 dots/mm)
  const TARGET_WIDTH = 812;
  const TARGET_HEIGHT = 1218;
  const MARGIN_MM = 5;
  const DOTS_PER_MM = 8; // 203 DPI ≈ 8 dots/mm
  const MARGIN_DOTS = MARGIN_MM * DOTS_PER_MM; // 40 dots

  const scaledCanvas = scaleCanvas(rotatedCanvas, TARGET_WIDTH, TARGET_HEIGHT, MARGIN_DOTS);

  const zpl = canvasToZPL(scaledCanvas);
  const previewUrl = scaledCanvas.toDataURL('image/png');

  return { zpl, previewUrl, width: TARGET_WIDTH, height: TARGET_HEIGHT };
}

async function renderPDFToCanvas(file: File, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1); // Render first page
  
  // Render at a high scale to ensure good quality before trimming/scaling down
  const viewport = page.getViewport({ scale: 3.0 });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  await page.render({ canvasContext: ctx, viewport } as any).promise;
}

async function renderImageToCanvas(file: File, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  return new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Fill with white background first (in case of transparent PNGs)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.drawImage(img, 0, 0);
      resolve();
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

function trimCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let top = height, bottom = 0, left = width, right = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx+1];
      const b = data[idx+2];
      const a = data[idx+3];

      // Consider white or transparent as empty
      const isWhiteOrTransparent = a < 128 || (r > 240 && g > 240 && b > 240);

      if (!isWhiteOrTransparent) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }

  // If empty image, return original
  if (top > bottom || left > right) return canvas;

  const trimmedWidth = right - left + 1;
  const trimmedHeight = bottom - top + 1;

  const trimmed = document.createElement('canvas');
  trimmed.width = trimmedWidth;
  trimmed.height = trimmedHeight;
  const tCtx = trimmed.getContext('2d')!;
  tCtx.putImageData(ctx.getImageData(left, top, trimmedWidth, trimmedHeight), 0, 0);

  return trimmed;
}

function rotateCanvasIfNeeded(canvas: HTMLCanvasElement): HTMLCanvasElement {
  // If landscape, rotate 90 degrees to portrait
  if (canvas.width > canvas.height) {
    const rotated = document.createElement('canvas');
    rotated.width = canvas.height;
    rotated.height = canvas.width;
    const ctx = rotated.getContext('2d')!;
    
    ctx.translate(rotated.width / 2, rotated.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    
    return rotated;
  }
  return canvas;
}

function scaleCanvas(canvas: HTMLCanvasElement, targetWidth: number, targetHeight: number, margin: number = 0): HTMLCanvasElement {
  const drawableWidth = targetWidth - (margin * 2);
  const drawableHeight = targetHeight - (margin * 2);

  const scale = Math.min(drawableWidth / canvas.width, drawableHeight / canvas.height);
  const newWidth = Math.floor(canvas.width * scale);
  const newHeight = Math.floor(canvas.height * scale);

  const scaled = document.createElement('canvas');
  scaled.width = targetWidth;
  scaled.height = targetHeight;
  const ctx = scaled.getContext('2d')!;

  // Fill with white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // Draw centered within the drawable area
  const dx = margin + (drawableWidth - newWidth) / 2;
  const dy = margin + (drawableHeight - newHeight) / 2;
  
  // Use high quality smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  ctx.drawImage(canvas, dx, dy, newWidth, newHeight);

  return scaled;
}

/**
 * Convert Canvas to ZPL ^GF (Graphic Field)
 * This implements the core binarization and hex encoding logic similar to zplbox.
 */
function canvasToZPL(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let hexString = '';
  const bytesPerRow = Math.ceil(width / 8);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < bytesPerRow; x++) {
      let byte = 0;
      for (let b = 0; b < 8; b++) {
        const pixelX = x * 8 + b;
        if (pixelX < width) {
          const idx = (y * width + pixelX) * 4;
          const r = data[idx];
          const g = data[idx+1];
          const b_color = data[idx+2];
          const a = data[idx+3];

          // Calculate luminance
          const lum = 0.299 * r + 0.587 * g + 0.114 * b_color;
          
          // If pixel is dark and not transparent, it's black (1 in ZPL)
          if (a > 128 && lum < 128) {
            byte |= (1 << (7 - b));
          }
        }
      }
      let hex = byte.toString(16).toUpperCase();
      if (hex.length === 1) hex = '0' + hex;
      hexString += hex;
    }
    hexString += '\n';
  }

  const totalBytes = bytesPerRow * height;
  
  // ^XA: Start Format
  // ^PW: Print Width
  // ^LL: Label Length
  // ^POI: Invert orientation (optional, but standard for 4x6)
  // ^FO0,0: Field Origin at 0,0
  // ^GFA: Graphic Field
  // ^FS: Field Separator
  // ^XZ: End Format
  return `^XA\n^PW${width}\n^LL${height}\n^FO0,0^GFA,${totalBytes},${totalBytes},${bytesPerRow},${hexString}^FS\n^XZ`;
}
