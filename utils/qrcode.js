const QRCode = require('qrcode')
const sharp = require('sharp')
const path = require('path')

// The public, customer-facing URL a printed table sticker points to - the
// frontend app's own origin, not this API. Configure via FRONTEND_URL in
// .env; falls back to the Vite dev server's default port.
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')

const tableScanUrl = (qrToken) => `${FRONTEND_URL}/t/${qrToken}`

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'kcl-logo.jpg')

// Layout for the printable sticker (all in px, at print-friendly resolution).
const QR_SIZE = 480
const LOGO_SIZE = Math.round(QR_SIZE * 0.22) // stays within "H" error-correction tolerance
const PADDING = 36
const HEADER_HEIGHT = 150
const FOOTER_HEIGHT = 56
const STICKER_WIDTH = QR_SIZE + PADDING * 2
const STICKER_HEIGHT = PADDING + HEADER_HEIGHT + QR_SIZE + FOOTER_HEIGHT + PADDING

const escapeXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const headerSvg = (tableLabel) => `
<svg width="${STICKER_WIDTH}" height="${HEADER_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#ffffff" />
  <text x="50%" y="42" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"
        font-size="26" font-weight="700" fill="#2c1810">Welcome to Kigali Coffee Lab</text>
  <text x="50%" y="96" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
        font-size="40" font-weight="800" fill="#a9814a">${escapeXml(tableLabel)}</text>
  <line x1="${PADDING}" y1="${HEADER_HEIGHT - 18}" x2="${STICKER_WIDTH - PADDING}" y2="${HEADER_HEIGHT - 18}"
        stroke="#ede0cd" stroke-width="2" />
</svg>`

const footerSvg = () => `
<svg width="${STICKER_WIDTH}" height="${FOOTER_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#ffffff" />
  <text x="50%" y="32" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
        font-size="20" font-weight="600" fill="#6f4e37">Scan to view the menu &amp; order</text>
</svg>`

// Returns a PNG buffer: the full printable table sticker - "Welcome to
// Kigali Coffee Lab" / "Table X" up top, the QR code (with the KCL logo
// composited into its center) in the middle, and a short caption below.
// High ("H") error correction is used specifically so the logo overlay
// doesn't break scannability (it tolerates ~30% of the code being obscured).
const generateTableStickerPng = async (table) => {
    const url = tableScanUrl(table.qrToken)

    const qrBuffer = await QRCode.toBuffer(url, {
        type: 'png',
        width: QR_SIZE,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: '#2c1810', light: '#ffffff' },
    })

    const logoBuffer = await sharp(LOGO_PATH)
        .resize(LOGO_SIZE, LOGO_SIZE, { fit: 'cover' })
        // small white ring behind the logo so it reads cleanly against the QR
        .extend({ top: 6, bottom: 6, left: 6, right: 6, background: '#ffffff' })
        .png()
        .toBuffer()

    const logoWithRingSize = LOGO_SIZE + 12
    const qrWithLogo = await sharp(qrBuffer)
        .composite([{
            input: logoBuffer,
            top: Math.round((QR_SIZE - logoWithRingSize) / 2),
            left: Math.round((QR_SIZE - logoWithRingSize) / 2),
        }])
        .png()
        .toBuffer()

    const headerBuffer = await sharp(Buffer.from(headerSvg(table.label))).png().toBuffer()
    const footerBuffer = await sharp(Buffer.from(footerSvg())).png().toBuffer()

    const sticker = await sharp({
        create: {
            width: STICKER_WIDTH,
            height: STICKER_HEIGHT,
            channels: 3,
            background: '#ffffff',
        },
    })
        .composite([
            { input: headerBuffer, top: 0, left: 0 },
            { input: qrWithLogo, top: HEADER_HEIGHT, left: PADDING },
            { input: footerBuffer, top: HEADER_HEIGHT + QR_SIZE, left: 0 },
        ])
        .png()
        .toBuffer()

    return sticker
}

module.exports = { tableScanUrl, generateTableStickerPng }
