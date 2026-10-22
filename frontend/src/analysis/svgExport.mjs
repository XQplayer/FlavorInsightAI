export function exportDimensions(width, height, scale = 1) {
  const w = Math.round(width * scale),
    h = Math.round(height * scale);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1 || w > 8192 || h > 8192 || w * h > 32e6) throw new Error('Invalid or excessive export dimensions');
  return {
    width: w,
    height: h
  };
}
export function serializeSvg(element, metadata = {}) {
  if (!element) throw new Error('SVG is not available');
  const clone = element.cloneNode(true),
    width = Number(clone.getAttribute('width')),
    height = Number(clone.getAttribute('height'));
  exportDimensions(width, height);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.removeAttribute('class');
  clone.removeAttribute('style');
  clone.querySelectorAll('[tabindex]').forEach(el => el.removeAttribute('tabindex'));
  const meta = document.createElementNS('http://www.w3.org/2000/svg', 'metadata');
  meta.textContent = JSON.stringify({
    ...metadata,
    pixels: {
      width,
      height
    },
    background: '#ffffff',
    format: 'SVG'
  });
  clone.prepend(meta);
  return new XMLSerializer().serializeToString(clone);
}
export async function rasterizeSvg(text, width, height, env = globalThis) {
  const dimensions = exportDimensions(width, height),
    url = env.URL.createObjectURL(new Blob([text], {
      type: 'image/svg+xml;charset=utf-8'
    }));
  try {
    const image = new env.Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('SVG image decoding failed'));
      image.src = url;
    });
    const canvas = env.document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('PNG canvas unavailable');
    context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encoding failed')), 'image/png'));
  } finally {
    env.URL.revokeObjectURL(url);
  }
}
