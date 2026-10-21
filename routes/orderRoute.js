const {
    createOrder, trackOrder, cancelByCode,
    uploadProof, uploadProofByCode, getOrders, getOrder, getUserOrders,
    cancelOrder, deleteOrder, updateOrderStatus, getOrderStats,
} = require('../controllers/orderController')
const { validateToken, StaffAuth, optionalAuth } = require('../middlewares/validateTokenHandler')
const { uploadProof: uploadProofMw } = require('../middlewares/uploadHandler')
const router = require('express').Router()

// Guest-friendly: no login required to place or track an order - the order
// code (and table number, for dine-in) is what the customer holds on to.
router.post('/', optionalAuth, createOrder)
router.get('/track/:code', trackOrder)
router.put('/track/:code/cancel', cancelByCode)
router.post('/track/:code/proof', uploadProofMw.single('proof'), uploadProofByCode)

// Logged-in users can still see their own order history if they have an account
router.get('/user-orders', validateToken, getUserOrders)
router.put('/:id/cancel', validateToken, cancelOrder)

// Staff (manageOrders permission)
router.get('/', StaffAuth('manageOrders'), getOrders)
router.get('/stats', StaffAuth('manageOrders'), getOrderStats)
router.get('/:id', validateToken, getOrder)
router.post('/:id/proof', StaffAuth('manageOrders'), uploadProofMw.single('proof'), uploadProof)
router.delete('/:id', StaffAuth('manageOrders'), deleteOrder)
router.put('/:id', StaffAuth('manageOrders'), updateOrderStatus)

module.exports = router
