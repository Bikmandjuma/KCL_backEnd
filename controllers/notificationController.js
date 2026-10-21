const asyncHandler = require('express-async-handler')
const { prisma } = require('../config/dbConnection')
const { toClientJSON } = require('../utils/transform')

// Public - no account needed. The app polls this for the order code it's
// currently tracking so it can show a badge count and a notifications screen.
getNotificationsForOrder = asyncHandler(async (req, res) => {
    const { code } = req.params
    const notifications = await prisma.notification.findMany({
        where: { orderCode: code },
        orderBy: { createdAt: 'desc' },
    })
    const unreadCount = notifications.filter((n) => !n.read).length
    res.status(200).json(toClientJSON({ notifications, unreadCount }))
})

markRead = asyncHandler(async (req, res) => {
    const notification = await prisma.notification.findUnique({ where: { id: Number(req.params.id) } })
    if (!notification) { res.status(404); throw new Error('Notification not found') }
    const updated = await prisma.notification.update({ where: { id: notification.id }, data: { read: true } })
    res.status(200).json(toClientJSON(updated))
})

markAllRead = asyncHandler(async (req, res) => {
    const { code } = req.params
    await prisma.notification.updateMany({ where: { orderCode: code }, data: { read: true } })
    res.status(200).json({ msg: 'all marked read' })
})

module.exports = { getNotificationsForOrder, markRead, markAllRead }
