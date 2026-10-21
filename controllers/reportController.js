const path = require('path')
const asyncHandler = require('express-async-handler')
const PDFDocument = require('pdfkit')
const { prisma } = require('../config/dbConnection')

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'kcl-logo.jpg')

const PERIOD_LABELS = {
    today: 'Today', yesterday: 'Yesterday', week: 'This Week',
    month: 'This Month', year: 'This Year', lifetime: 'Lifetime',
}

// Mirrors the same period math used by the Orders page's analytics cards
// (controllers/orderController.js's periodRange) - kept as its own small
// copy here so the reports feature has no dependency on that file's
// internals, and can't silently drift if one changes without the other.
const periodRange = (period) => {
    const now = new Date()
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0)
    if (period === 'today') return { gte: startOfToday }
    if (period === 'yesterday') {
        const start = new Date(startOfToday); start.setDate(start.getDate() - 1)
        return { gte: start, lt: startOfToday }
    }
    if (period === 'week') {
        const start = new Date(startOfToday); start.setDate(start.getDate() - start.getDay())
        return { gte: start }
    }
    if (period === 'month') {
        const start = new Date(startOfToday); start.setDate(1)
        return { gte: start }
    }
    if (period === 'year') {
        const start = new Date(startOfToday); start.setMonth(0, 1)
        return { gte: start }
    }
    return null // lifetime
}

const parseYMD = (s) => {
    // Expects "YYYY-MM-DD" (what a date <input> sends) - parsed as local
    // midnight, never UTC, so "today" in the browser means today here too.
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''))
    if (!m) return null
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    return isNaN(d.getTime()) ? null : d
}

const RWF = (n) => `${Math.round(n).toLocaleString('en-US')} RWF`
const MAX_LISTED_ORDERS = 200
const typeLabels = { dine_in: 'Dine-in', pickup: 'Pickup', delivery: 'Delivery (machines)' }
const paymentLabels = { Cash: 'Cash', MoMoPay: 'MoMo Pay', MoMoCode: 'MoMo Code' }
const dayLabel = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

// Streams a PDF report straight to the response - covers orders and a
// breakdown "analysis" (by status, by order type, by payment method) for
// whichever date filter the staff member picked: one of the preset
// periods, a single specific date, or a from/to date range. Nothing is
// saved to disk; it's generated fresh on each request and piped directly
// into the download.
const generateOrdersReport = asyncHandler(async (req, res) => {
    const { period, date, from, to } = req.query

    // A specific date or range always wins over a preset period when given.
    let createdAtRange = null
    let titleLabel

    const singleDate = parseYMD(date)
    const fromDate = parseYMD(from)
    const toDate = parseYMD(to)

    if (fromDate || toDate) {
        if (!fromDate || !toDate) {
            return res.status(400).json({ msg: 'A date range needs both "from" and "to" dates (YYYY-MM-DD).' })
        }
        if (fromDate > toDate) {
            return res.status(400).json({ msg: '"from" must be on or before "to".' })
        }
        const toExclusive = new Date(toDate); toExclusive.setDate(toExclusive.getDate() + 1)
        createdAtRange = { gte: fromDate, lt: toExclusive }
        titleLabel = fromDate.getTime() === toDate.getTime()
            ? dayLabel(fromDate)
            : `${dayLabel(fromDate)} – ${dayLabel(toDate)}`
    } else if (singleDate) {
        const nextDay = new Date(singleDate); nextDay.setDate(nextDay.getDate() + 1)
        createdAtRange = { gte: singleDate, lt: nextDay }
        titleLabel = dayLabel(singleDate)
    } else {
        const p = String(period || 'today')
        if (!PERIOD_LABELS[p]) {
            return res.status(400).json({ msg: `Unknown period "${p}". Use one of: ${Object.keys(PERIOD_LABELS).join(', ')}, or a "date" / "from"+"to".` })
        }
        createdAtRange = periodRange(p)
        titleLabel = PERIOD_LABELS[p]
    }

    const where = createdAtRange ? { createdAt: createdAtRange } : {}

    const orders = await prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
            orderCode: true, orderType: true, orderStatus: true,
            paymentAmount: true, paymentMethod: true,
            customerName: true, customerPhone: true, createdAt: true,
        },
    })

    const totalRevenue = orders.reduce((sum, o) => sum + o.paymentAmount, 0)
    const byStatus = {}
    const byType = {}
    const byPayment = {}
    for (const o of orders) {
        byStatus[o.orderStatus] = (byStatus[o.orderStatus] || 0) + 1
        if (!byType[o.orderType]) byType[o.orderType] = { count: 0, revenue: 0 }
        byType[o.orderType].count += 1
        byType[o.orderType].revenue += o.paymentAmount
        const pm = o.paymentMethod || 'Cash'
        if (!byPayment[pm]) byPayment[pm] = { count: 0, revenue: 0 }
        byPayment[pm].count += 1
        byPayment[pm].revenue += o.paymentAmount
    }

    const doc = new PDFDocument({ size: 'A4', margin: 40 })
    const filename = `KCL-orders-report-${(date || (from && to ? `${from}_to_${to}`: null) || period || 'today')}-${new Date().toISOString().slice(0, 10)}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    doc.pipe(res)

    // --- Header, with the logo in the top-right corner ---
    try { doc.image(LOGO_PATH, 495, 36, { width: 60, height: 60 }) } catch { /* logo missing - skip it, the report still works */ }
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#2d1a0f').text('Kigali Coffee Lab', 40, 40, { width: 440 })
    doc.fontSize(14).font('Helvetica').fillColor('#6b4a33').text(`Orders Report — ${titleLabel}`, 40, doc.y, { width: 440 })
    doc.fontSize(9).fillColor('#9a8270').text(`Generated ${new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`, 40, doc.y, { width: 440 })
    doc.y = Math.max(doc.y, 100)
    doc.moveDown(0.6)
    doc.strokeColor('#e8ddd0').moveTo(40, doc.y).lineTo(555, doc.y).stroke()
    doc.moveDown(1)

    // --- Summary ---
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#2d1a0f').text('Summary')
    doc.moveDown(0.4)
    doc.fontSize(10).font('Helvetica').fillColor('#2d1a0f')
    doc.text(`Total Orders: ${orders.length}`)
    doc.text(`Total Revenue: ${RWF(totalRevenue)}`)
    doc.text(`Average Order Value: ${orders.length ? RWF(totalRevenue / orders.length) : RWF(0)}`)
    doc.moveDown(1)

    // --- By status ---
    doc.fontSize(13).font('Helvetica-Bold').text('By Status')
    doc.moveDown(0.3)
    doc.fontSize(10).font('Helvetica')
    if (Object.keys(byStatus).length === 0) doc.fillColor('#9a8270').text('No orders in this period.')
    else Object.entries(byStatus).forEach(([status, count]) => doc.fillColor('#2d1a0f').text(`${status}: ${count}`))
    doc.moveDown(1)

    // --- By order type ---
    doc.fontSize(13).font('Helvetica-Bold').text('By Order Type')
    doc.moveDown(0.3)
    doc.fontSize(10).font('Helvetica')
    if (Object.keys(byType).length === 0) doc.fillColor('#9a8270').text('No orders in this period.')
    else Object.entries(byType).forEach(([type, d]) => doc.fillColor('#2d1a0f').text(`${typeLabels[type] || type}: ${d.count} orders, ${RWF(d.revenue)}`))
    doc.moveDown(1)

    // --- By payment method - so the owner can see at a glance how much
    // came in as cash vs MoMo, without opening every single order ---
    doc.fontSize(13).font('Helvetica-Bold').text('By Payment Method')
    doc.moveDown(0.3)
    doc.fontSize(10).font('Helvetica')
    if (Object.keys(byPayment).length === 0) doc.fillColor('#9a8270').text('No orders in this period.')
    else Object.entries(byPayment).forEach(([pm, d]) => doc.fillColor('#2d1a0f').text(`${paymentLabels[pm] || pm}: ${d.count} orders, ${RWF(d.revenue)}`))
    doc.moveDown(1.2)

    // --- Order list (capped so the PDF stays a sane size) ---
    doc.fontSize(13).font('Helvetica-Bold').text('Orders')
    doc.moveDown(0.4)
    if (orders.length > MAX_LISTED_ORDERS) {
        doc.fontSize(9).font('Helvetica-Oblique').fillColor('#9a8270')
            .text(`Showing the most recent ${MAX_LISTED_ORDERS} of ${orders.length} orders.`)
        doc.moveDown(0.3)
    }
    const listed = orders.slice(0, MAX_LISTED_ORDERS)
    if (listed.length === 0) {
        doc.fontSize(10).font('Helvetica').fillColor('#9a8270').text('No orders in this period.')
    } else {
        // Amount and Payment sit right next to each other, exactly so the
        // owner can read "how much" and "paid how" in one glance per row.
        const colX = { code: 40, customer: 112, type: 215, amount: 275, payment: 345, status: 430 }
        const drawRow = (y, cells, opts = {}) => {
            doc.fontSize(8).font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(opts.color || '#2d1a0f')
            doc.text(cells.code, colX.code, y, { width: 70 })
            doc.text(cells.customer, colX.customer, y, { width: 100 })
            doc.text(cells.type, colX.type, y, { width: 58 })
            doc.text(cells.amount, colX.amount, y, { width: 68 })
            doc.text(cells.payment, colX.payment, y, { width: 83 })
            doc.text(cells.status, colX.status, y, { width: 110 })
        }
        drawRow(doc.y, { code: 'Order', customer: 'Customer', type: 'Type', amount: 'Amount', payment: 'Payment', status: 'Status' }, { bold: true, color: '#6b4a33' })
        doc.moveDown(0.6)
        doc.strokeColor('#e8ddd0').moveTo(40, doc.y).lineTo(555, doc.y).stroke()
        doc.moveDown(0.3)

        for (const o of listed) {
            if (doc.y > 760) {
                doc.addPage()
                doc.y = 40
            }
            drawRow(doc.y, {
                code: o.orderCode,
                customer: o.customerName || '—',
                type: typeLabels[o.orderType] || o.orderType,
                amount: RWF(o.paymentAmount),
                payment: paymentLabels[o.paymentMethod] || o.paymentMethod || 'Cash',
                status: o.orderStatus,
            })
            doc.moveDown(0.9)
        }
    }

    doc.end()
})

module.exports = { generateOrdersReport }
