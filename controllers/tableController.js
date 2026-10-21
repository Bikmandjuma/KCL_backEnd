const asyncHandler = require('express-async-handler')
const { prisma } = require('../config/dbConnection')
const { toClientJSON } = require('../utils/transform')
const { getPagination, buildPageResult } = require('../utils/paginate')
const { toNumber, toBool } = require('../utils/coerce')
const { generateTableStickerPng } = require('../utils/qrcode')

// Orders at a table are always dine_in (the only type that ever has a
// tableId). An order "occupies" its table until it reaches one of these -
// everything else (Order Placed, Preparing, Ready for Pickup) still blocks
// a fresh order from starting at the same table.
const TERMINAL_TABLE_STATUSES = ['Served', 'Cancelled']

// A booking is "soon" if its reserved window starts within this many minutes.
// Two different windows before a reservation's start time: inside
// WARN_WINDOW_MINUTES we just let the customer know a reservation is
// coming (and show them how long they have); inside the tighter
// BLOCK_WINDOW_MINUTES we stop new orders at that table altogether, since
// the reserved party could walk in at any moment.
const WARN_WINDOW_MINUTES = 60
const BLOCK_WINDOW_MINUTES = 30

// Public - active tables only, so the app can show a table picker when a
// customer places a dine-in coffee/food order.
// ?all=true (staff only in practice, but not enforced here) also returns
// hidden/inactive tables for the admin dashboard's table manager.
getTables = asyncHandler(async (req, res) => {
    const { all } = req.query
    const where = all ? {} : { active: true }
    const tables = await prisma.table.findMany({ where, orderBy: { label: 'asc' } })
    res.status(200).json(toClientJSON(tables))
})

getTable = asyncHandler(async (req, res) => {
    const table = await prisma.table.findUnique({ where: { id: Number(req.params.id) } })
    if (!table) { res.status(404); throw new Error('Table not found') }
    res.status(200).json(toClientJSON(table))
})

// Admin / permitted Manager (manageTables) - add a table, e.g. "Table 1".
// A qrToken is generated automatically (see schema.prisma) the moment the
// row is created - nothing extra to do here.
createTable = asyncHandler(async (req, res) => {
    const { label, capacity, active } = req.body
    if (!label) {
        res.status(400)
        throw new Error('Table label is mandatory (e.g. "Table 1")')
    }
    const existing = await prisma.table.findUnique({ where: { label } })
    if (existing) {
        res.status(400)
        throw new Error('A table with that label already exists')
    }
    const table = await prisma.table.create({
        data: { label, capacity: toNumber(capacity), active: active === undefined ? undefined : toBool(active) },
    })
    res.status(201).json(toClientJSON(table))
})

updateTable = asyncHandler(async (req, res) => {
    const table = await prisma.table.findUnique({ where: { id: Number(req.params.id) } })
    if (!table) { res.status(404); throw new Error('Table not found') }
    const { label, capacity, active } = req.body
    const data = {}
    if (label !== undefined) data.label = label
    if (capacity !== undefined) data.capacity = toNumber(capacity)
    if (active !== undefined) data.active = toBool(active)
    const updated = await prisma.table.update({ where: { id: table.id }, data })
    res.status(200).json(toClientJSON(updated))
})

deleteTable = asyncHandler(async (req, res) => {
    const table = await prisma.table.findUnique({ where: { id: Number(req.params.id) } })
    if (!table) { res.status(404); throw new Error('Table not found') }
    await prisma.table.delete({ where: { id: table.id } })
    res.status(200).json({ msg: 'deleted' })
})

// Staff (manageTables) - the full printable sticker PNG: "Welcome to Kigali
// Coffee Lab" / the table's name up top, the QR (with the KCL logo
// composited into its center) in the middle, a short caption below.
downloadTableQr = asyncHandler(async (req, res) => {
    const table = await prisma.table.findUnique({ where: { id: Number(req.params.id) } })
    if (!table) { res.status(404); throw new Error('Table not found') }
    const png = await generateTableStickerPng(table)
    res.set('Content-Type', 'image/png')
    res.set('Content-Disposition', `attachment; filename="${table.label.replace(/\s+/g, '-')}-qr.png"`)
    res.send(png)
})

// Public - what a phone camera actually opens when it scans the sticker.
// Tells the frontend whether this table is free to order at right now, has
// a pending order it should resume tracking instead, and whether a
// reservation is starting soon it should warn the customer about.
getTableByQr = asyncHandler(async (req, res) => {
    const table = await prisma.table.findUnique({ where: { qrToken: req.params.qrToken } })
    if (!table || !table.active) {
        res.status(404)
        throw new Error('This table QR code is not recognised. Please ask a staff member for help.')
    }

    const activeOrder = await prisma.order.findFirst({
        where: { tableId: table.id, orderStatus: { notIn: TERMINAL_TABLE_STATUSES } },
        include: { products: true },
        orderBy: { createdAt: 'desc' },
    })

    const now = new Date()
    const warnCutoff = new Date(now.getTime() + WARN_WINDOW_MINUTES * 60000)
    const upcomingBookingLink = await prisma.tableBookingTable.findFirst({
        where: {
            tableId: table.id,
            booking: {
                status: { in: ['Upcoming', 'Active'] },
                startTime: { lte: warnCutoff },
            },
        },
        include: { booking: true },
        orderBy: { booking: { startTime: 'asc' } },
    })
    let upcomingBooking = null
    if (upcomingBookingLink) {
        const b = upcomingBookingLink.booking
        const endsAt = new Date(new Date(b.startTime).getTime() + b.durationMinutes * 60000)
        // Only actually worth warning about if the reservation hasn't already
        // finished (an old "Upcoming" booking nobody marked Completed yet).
        if (endsAt > now) {
            const isNow = new Date(b.startTime) <= now && now <= endsAt
            const minutesUntilStart = Math.max(0, Math.round((new Date(b.startTime) - now) / 60000))
            upcomingBooking = {
                ...b,
                isNow,
                minutesUntilStart,
                // Inside the block window (or already underway) - this table
                // can't take a new order right now at all, only a warning.
                blocked: isNow || minutesUntilStart <= BLOCK_WINDOW_MINUTES,
            }
        }
    }

    res.status(200).json(toClientJSON({ table, activeOrder, upcomingBooking }))
})

// ---------------- Table Bookings / Reservations ----------------

// Public - anyone can reserve a table (or several) ahead of time, same
// guest-friendly pattern as placing an order: no account needed.
createBooking = asyncHandler(async (req, res) => {
    const { tableIds, customerName, customerPhone, partySize, startTime, durationMinutes, notes } = req.body
    const ids = Array.isArray(tableIds) ? tableIds.map(Number) : [Number(tableIds)]
    if (!ids.length || ids.some((id) => !id)) {
        res.status(400)
        throw new Error('Please choose at least one table')
    }
    if (!customerName || !customerPhone || !startTime) {
        res.status(400)
        throw new Error('Name, phone and reservation time are mandatory')
    }
    const start = new Date(startTime)
    if (Number.isNaN(start.getTime()) || start < new Date()) {
        res.status(400)
        throw new Error('Please choose a valid time in the future')
    }
    const duration = toNumber(durationMinutes) || 60
    const end = new Date(start.getTime() + duration * 60000)

    const tables = await prisma.table.findMany({ where: { id: { in: ids }, active: true } })
    if (tables.length !== ids.length) {
        res.status(400)
        throw new Error('One or more selected tables are not available')
    }

    // Reject if any chosen table already has an overlapping, non-cancelled booking.
    const conflicts = await prisma.tableBookingTable.findMany({
        where: {
            tableId: { in: ids },
            booking: {
                status: { in: ['Upcoming', 'Active'] },
                startTime: { lt: end },
            },
        },
        include: { booking: true },
    })
    const hasOverlap = conflicts.some((c) => {
        const cEnd = new Date(new Date(c.booking.startTime).getTime() + c.booking.durationMinutes * 60000)
        return cEnd > start
    })
    if (hasOverlap) {
        res.status(400)
        throw new Error('One of those tables is already booked around that time. Please pick another time or table.')
    }

    const booking = await prisma.tableBooking.create({
        data: {
            customerName, customerPhone,
            partySize: toNumber(partySize) || 1,
            startTime: start,
            durationMinutes: duration,
            notes,
            tables: { create: ids.map((tableId) => ({ tableId })) },
        },
        include: { tables: { include: { table: true } } },
    })
    res.status(201).json(toClientJSON(booking))
})

// Staff (manageTables) - paginated/searchable/filterable booking list
getBookings = asyncHandler(async (req, res) => {
    const { search, status, page: pageQ, limit: limitQ } = req.query
    const where = {}
    if (status) where.status = status
    if (search) {
        where.OR = [
            { customerName: { contains: search } },
            { customerPhone: { contains: search } },
        ]
    }
    const include = { tables: { include: { table: true } } }

    if (!pageQ && !limitQ) {
        const bookings = await prisma.tableBooking.findMany({ where, include, orderBy: { startTime: 'asc' } })
        return res.status(200).json(toClientJSON(bookings))
    }
    const { page, limit, offset } = getPagination(req.query, 10)
    const [rows, count] = await Promise.all([
        prisma.tableBooking.findMany({ where, include, orderBy: { startTime: 'asc' }, take: limit, skip: offset }),
        prisma.tableBooking.count({ where }),
    ])
    res.status(200).json(toClientJSON(buildPageResult({ rows, count }, page, limit)))
})

updateBooking = asyncHandler(async (req, res) => {
    const booking = await prisma.tableBooking.findUnique({ where: { id: Number(req.params.id) } })
    if (!booking) { res.status(404); throw new Error('Booking not found') }
    const { status, startTime, durationMinutes, partySize, notes } = req.body
    const data = {}
    if (status !== undefined) data.status = status
    if (startTime !== undefined) data.startTime = new Date(startTime)
    if (durationMinutes !== undefined) data.durationMinutes = toNumber(durationMinutes)
    if (partySize !== undefined) data.partySize = toNumber(partySize)
    if (notes !== undefined) data.notes = notes
    const updated = await prisma.tableBooking.update({
        where: { id: booking.id }, data,
        include: { tables: { include: { table: true } } },
    })
    res.status(200).json(toClientJSON(updated))
})

module.exports = {
    getTables, getTable, createTable, updateTable, deleteTable, downloadTableQr, getTableByQr,
    createBooking, getBookings, updateBooking,
}
