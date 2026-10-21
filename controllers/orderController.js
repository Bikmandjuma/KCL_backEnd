const asyncHandler = require('express-async-handler')
const uniqid = require('uniqid')
const { prisma } = require('../config/dbConnection')
const { toClientJSON } = require('../utils/transform')
const { getPagination, buildPageResult } = require('../utils/paginate')
const { codeFromOrderId } = require('../utils/orderCode')
const { INITIAL_STATUS, isValidStatus, stagesFor } = require('../utils/orderStages')

const ORDER_INCLUDE = { products: true, table: true }

// Shared by getOrders (period filter) and getOrderStats (the analytics
// cards) so both agree on exactly where "today", "this week", etc. start.
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
    return null // 'lifetime' or unrecognised - no date filter
}

// Public API keeps using the original display strings ("MoMo Pay", "MoMo
// Code") - Prisma's Client, because of the @map on those enum values in
// schema.prisma, needs the un-mapped identifiers instead when writing.
const PAYMENT_METHOD_TO_DB = { Cash: 'Cash', 'MoMo Pay': 'MoMoPay', 'MoMo Code': 'MoMoCode' }

// Guest-friendly checkout: no login/registration required. The client sends
// the items it wants directly (itemType 'menu' = coffee/food, 'machine' =
// coffee machine) rather than relying on a server-side Cart tied to an
// account. Coffee/food can only ever be dine-in/pickup - never delivery.
createOrder = asyncHandler(async (req, res) => {
    const {
        items, tableId, orderType: requestedType,
        customerName, customerPhone, email, address, contact,
        paymentMethod, callConfirmed, notes,
    } = req.body

    if (!Array.isArray(items) || !items.length) {
        res.status(400)
        throw new Error('Your order has no items')
    }

    const allowedPayments = ['Cash', 'MoMo Pay', 'MoMo Code']
    if (paymentMethod && !allowedPayments.includes(paymentMethod)) {
        res.status(400)
        throw new Error(`paymentMethod must be one of: ${allowedPayments.join(', ')}`)
    }

    // Resolve each line item against its real record, snapshot title/price/image
    const resolvedItems = []
    for (const line of items) {
        const quantity = Number(line.quantity) || 1
        if (line.itemType === 'menu') {
            const drink = await prisma.drink.findUnique({ where: { id: Number(line.itemId) } })
            if (!drink || !drink.available) {
                res.status(400)
                throw new Error(`"${line.itemId}" is not available on the menu right now`)
            }
            resolvedItems.push({
                itemType: 'menu', menuItemId: drink.id, quantity,
                title: drink.name, image: drink.image, price: drink.price,
            })
        } else {
            const product = await prisma.product.findUnique({ where: { id: Number(line.itemId) } })
            if (!product || !product.active) {
                res.status(400)
                throw new Error(`Product "${line.itemId}" is not available`)
            }
            if (product.quantity < quantity) {
                res.status(400)
                throw new Error(`Only ${product.quantity} left in stock for "${product.title}"`)
            }
            resolvedItems.push({
                itemType: 'machine', productId: product.id, quantity,
                title: product.title, image: product.image, price: product.price,
            })
        }
    }

    const hasMenuItems = resolvedItems.some((i) => i.itemType === 'menu')
    const hasMachineItems = resolvedItems.some((i) => i.itemType === 'machine')

    // Coffee/food is always dine-in or pickup - it can never be delivered.
    // A machine-only order defaults to delivery unless the customer asked
    // to pick it up in person.
    let orderType
    if (hasMenuItems) {
        orderType = requestedType === 'pickup' ? 'pickup' : 'dine_in'
    } else {
        orderType = requestedType === 'dine_in' || requestedType === 'pickup' ? requestedType : 'delivery'
    }

    let table = null
    if (orderType === 'dine_in') {
        if (!tableId) {
            res.status(400)
            throw new Error('A table is required for a dine-in order')
        }
        table = await prisma.table.findUnique({ where: { id: Number(tableId) } })
        if (!table || !table.active) {
            res.status(400)
            throw new Error('That table is not available')
        }

        // Mirrors the two checks the scan screen already shows the
        // customer (tableController.js's getTableByQr) - re-checked here
        // too so a direct API call can't skip past either of them.
        const activeOrder = await prisma.order.findFirst({
            where: { tableId: table.id, orderStatus: { notIn: ['Served', 'Cancelled'] } },
        })
        if (activeOrder) {
            res.status(400)
            throw new Error('This table already has an order in progress. Please wait until it is served.')
        }

        const now = new Date()
        const blockCutoff = new Date(now.getTime() + 30 * 60000)
        const blockingBookingLink = await prisma.tableBookingTable.findFirst({
            where: {
                tableId: table.id,
                booking: { status: { in: ['Upcoming', 'Active'] }, startTime: { lte: blockCutoff } },
            },
            include: { booking: true },
        })
        if (blockingBookingLink) {
            const b = blockingBookingLink.booking
            const endsAt = new Date(new Date(b.startTime).getTime() + b.durationMinutes * 60000)
            if (endsAt > now) {
                res.status(400)
                throw new Error('This table is reserved soon and cannot take new orders right now. Please choose another table or come back later.')
            }
        }
    }

    if (orderType === 'delivery' && !address) {
        res.status(400)
        throw new Error('A delivery address is required for a coffee machine order')
    }

    const total = resolvedItems.reduce((sum, i) => sum + i.price * i.quantity, 0)

    // orderCode is sequential and derived from the order's own id (see
    // utils/orderCode.js), which Prisma only assigns once the row actually
    // exists - so we create the row first with a throwaway placeholder
    // (just needs to satisfy the @unique constraint for an instant), then
    // immediately rewrite it to the real "KCL-0000001"-style code. Wrapped
    // in a transaction so no caller can ever observe the placeholder.
    const order = await prisma.$transaction(async (tx) => {
        const created = await tx.order.create({
            data: {
                orderById: req.user ? req.user._id : null, // optional - guests order with no account
                orderCode: `TEMP-${uniqid()}`,
                orderType,
                tableId: table ? table.id : null,
                customerName, customerPhone,
                paymentIntentId: uniqid(),
                paymentMethod: PAYMENT_METHOD_TO_DB[paymentMethod || 'Cash'],
                paymentAmount: total,
                paymentCurrency: 'RWF',
                paymentStatus: INITIAL_STATUS,
                orderStatus: INITIAL_STATUS,
                callConfirmed: !!callConfirmed,
                email, address, contact, notes,
                products: {
                    create: resolvedItems.map((item) => ({
                        itemType: item.itemType,
                        productId: item.productId || null,
                        menuItemId: item.menuItemId || null,
                        quantity: item.quantity,
                        title: item.title,
                        image: item.image,
                        price: item.price,
                    })),
                },
            },
        })
        return tx.order.update({
            where: { id: created.id },
            data: { orderCode: codeFromOrderId(created.id) },
            include: ORDER_INCLUDE,
        })
    })

    // decrement stock for machine items only, best-effort
    if (hasMachineItems) {
        try {
            for (const item of resolvedItems) {
                if (item.itemType !== 'machine') continue
                const product = await prisma.product.findUnique({ where: { id: item.productId } })
                if (product) {
                    await prisma.product.update({
                        where: { id: product.id },
                        data: {
                            quantity: Math.max(0, product.quantity - item.quantity),
                            sold: product.sold + item.quantity,
                        },
                    })
                }
            }
        } catch (e) { /* non-fatal */ }
    }

    res.status(201).json(toClientJSON({ message: 'Success', order }))
})

// Public - the only thing a guest needs to check on their order: its code
// (and table number, for dine-in). No login required.
trackOrder = asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
        where: { orderCode: req.params.code },
        include: ORDER_INCLUDE,
    })
    if (!order) { res.status(404); throw new Error('Order not found') }
    res.status(200).json(toClientJSON(order))
})

// Public - a guest can only cancel while still at the very first stage
// (before staff has started preparing/confirming it).
cancelByCode = asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { orderCode: req.params.code } })
    if (!order) { res.status(404); throw new Error('Order not found') }
    const stages = stagesFor(order.orderType)
    const currentIndex = stages.indexOf(order.orderStatus)
    if (currentIndex > 0) {
        res.status(400)
        throw new Error('This order is already being handled and can no longer be cancelled')
    }
    const updated = await prisma.order.update({
        where: { id: order.id },
        data: { orderStatus: 'Cancelled', paymentStatus: 'Cancelled' },
    })
    res.status(200).json(toClientJSON(updated))
})

// Staff utility - attach proof of payment to any order on the customer's
// behalf (e.g. they sent a screenshot over WhatsApp). Guests use the public
// code-based endpoint below instead - they never have a login token.
uploadProof = asyncHandler(async(req,res)=>{
    const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) } })
    if (!order){ res.status(404); throw new Error('Order not found') }
    if (!req.file){ res.status(400); throw new Error('No file uploaded') }
    const updated = await prisma.order.update({
        where: { id: order.id },
        data: {
            proofOfPayment: `/uploads/proofs/${req.file.filename}`,
            paymentStatus: 'Proof Submitted',
        },
    })
    res.status(200).json(toClientJSON(updated))
})

// Public - a guest uploads proof of payment for their own order using its
// public orderCode. No login required: this is the endpoint the app and
// website actually call after checkout (uploadProof above requires a staff
// token and only exists as an admin-side fallback).
uploadProofByCode = asyncHandler(async(req,res)=>{
    const order = await prisma.order.findUnique({ where: { orderCode: req.params.code } })
    if (!order){ res.status(404); throw new Error('Order not found') }
    if (!req.file){ res.status(400); throw new Error('No file uploaded') }
    const updated = await prisma.order.update({
        where: { id: order.id },
        data: {
            proofOfPayment: `/uploads/proofs/${req.file.filename}`,
            paymentStatus: 'Proof Submitted',
        },
    })
    res.status(200).json(toClientJSON(updated))
})

getOrders = asyncHandler(async(req,res)=>{
    const { status, orderType, search, period, page: pageQ, limit: limitQ } = req.query
    const where = {}
    if (status) where.orderStatus = status
    if (orderType) where.orderType = orderType
    const createdAtRange = periodRange(period)
    if (createdAtRange) where.createdAt = createdAtRange
    if (search) {
        where.OR = [
            { orderCode: { contains: search } },
            { contact: { contains: search } },
            { customerName: { contains: search } },
            { email: { contains: search } },
        ]
    }

    const include = {
        ...ORDER_INCLUDE,
        orderby: { select: { id: true, username: true, email: true, phone: true } },
    }

    if (!pageQ && !limitQ) {
        const orders = await prisma.order.findMany({ where, include, orderBy: { createdAt: 'desc' } })
        return res.json(toClientJSON(orders))
    }

    const { page, limit, offset } = getPagination(req.query, 10)
    const [rows, count] = await Promise.all([
        prisma.order.findMany({ where, include, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
        prisma.order.count({ where }),
    ])
    res.json(toClientJSON(buildPageResult({ rows, count }, page, limit)))
})

getOrder = asyncHandler(async(req,res)=>{
    const order = await prisma.order.findUnique({
        where: { id: Number(req.params.id) },
        include: {
            ...ORDER_INCLUDE,
            orderby: { select: { id: true, username: true, email: true, phone: true } },
        },
    })
    res.json(toClientJSON(order))
})

getUserOrders = asyncHandler(async (req, res) => {
    const userId = req.user._id
    const orders = await prisma.order.findMany({
        where: { orderById: userId },
        include: ORDER_INCLUDE,
        orderBy: { createdAt: 'desc' },
    })
    res.json(toClientJSON(orders))
})

// Logged-in client cancels their own order (only while not yet handled)
cancelOrder = asyncHandler(async(req,res)=>{
    const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) } })
    if (!order){ res.status(404); throw new Error('Order not found') }
    if (String(order.orderById) !== String(req.user._id) && !req.user.isAdmin){
        res.status(403); throw new Error('Not your order')
    }
    const stages = stagesFor(order.orderType)
    if (stages.indexOf(order.orderStatus) > 0){
        res.status(400); throw new Error('This order can no longer be cancelled')
    }
    const updated = await prisma.order.update({ where: { id: order.id }, data: { orderStatus: 'Cancelled' } })
    res.json(toClientJSON(updated))
})

deleteOrder = asyncHandler(async(req,res)=>{
    const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) } })
    if (order) await prisma.order.delete({ where: { id: order.id } })
    res.json({ msg: 'successfully deleted', userOrderAvailable: toClientJSON(order) })
})

// Staff only (manageOrders). Every stage past "Order Placed" is only ever
// set here - nothing auto-advances on its own. Also drops a Notification so
// the guest's app (polling by orderCode) can show it.
updateOrderStatus = asyncHandler(async (req, res) => {
    const { status, etaMinutes } = req.body
    const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) } })
    if (!order){ res.status(404); throw new Error('Order not found') }

    if (!isValidStatus(order.orderType, status)) {
        res.status(400)
        throw new Error(`Invalid status for a ${order.orderType} order. Allowed: ${stagesFor(order.orderType).join(', ')}, Cancelled`)
    }

    // Moving to "Preparing" (dine-in/pickup only - delivery orders never
    // reach this stage) requires staff to say how long it'll take, so the
    // customer's tracking screen can show a live countdown.
    const data = { orderStatus: status, paymentStatus: status }
    if (status === 'Preparing') {
        const minutes = Number(etaMinutes)
        if (!minutes || minutes <= 0) {
            res.status(400)
            throw new Error('etaMinutes (how many minutes until ready) is required when setting status to "Preparing"')
        }
        data.etaMinutes = minutes
        data.etaSetAt = new Date()
    }

    const updated = await prisma.order.update({
        where: { id: order.id },
        data,
    })

    await prisma.notification.create({
        data: {
            orderCode: order.orderCode,
            title: 'Order update',
            message: status === 'Preparing'
                ? `Your order ${order.orderCode} is now "Preparing" - ready in about ${data.etaMinutes} min.`
                : `Your order ${order.orderCode} is now "${status}".`,
            type: 'order_status',
            orderId: order.id,
        },
    })

    res.json(toClientJSON(updated))
})

// Order counts by period, for the admin Orders page's analytics cards -
// Today, Yesterday, This Week, This Month, This Year, Lifetime.
getOrderStats = asyncHandler(async (req, res) => {
    const periods = ['today', 'yesterday', 'week', 'month', 'year', 'lifetime']
    const entries = await Promise.all(
        periods.map(async (p) => [p, await prisma.order.count({ where: { createdAt: periodRange(p) || undefined } })])
    )
    // The very first order ever placed - the admin Reports page uses this
    // as the earliest selectable date, since nothing happened before it.
    const firstOrder = await prisma.order.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } })
    res.status(200).json({ ...Object.fromEntries(entries), firstOrderDate: firstOrder ? firstOrder.createdAt : null })
})

module.exports = {
    createOrder, trackOrder, cancelByCode,
    uploadProof, uploadProofByCode, getOrders, getOrder, getUserOrders,
    cancelOrder, deleteOrder, updateOrderStatus, getOrderStats,
}
