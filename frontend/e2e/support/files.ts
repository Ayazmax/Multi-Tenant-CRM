// A valid 1x1 PNG.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

export const files = {
  png: { name: 'logo.png', mimeType: 'image/png', buffer: PNG_1X1 },
  svg: {
    name: 'logo.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
  },
  pdf: { name: 'brochure.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 fake') },
  oversized: { name: 'huge.png', mimeType: 'image/png', buffer: Buffer.alloc(2 * 1024 * 1024 + 1, 1) },
  /** Text renamed to .png: passes the browser type check, must be rejected by the server. */
  fakePng: { name: 'not-really.png', mimeType: 'image/png', buffer: Buffer.from('definitely not an image') },
}
