const { getNotificationsForOrder, markRead, markAllRead } = require('../controllers/notificationController')
const router = require('express').Router()

// All public - guests have no account, only their order code
router.get('/:code', getNotificationsForOrder)
router.put('/:id/read', markRead)
router.put('/:code/read-all', markAllRead)

module.exports = router
