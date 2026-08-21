const { createOrder, uploadProof, getOrders, getOrder, getUserOrders, cancelOrder, deleteOrder, updateOrderStatus } = require('../controllers/orderController')
const { validateToken, StaffAuth } = require('../middlewares/validateTokenHandler')
const { uploadProof: uploadProofMw } = require('../middlewares/uploadHandler')
const router = require('express').Router()

router.post('/', validateToken, createOrder)
router.get('/user-orders', validateToken, getUserOrders)
router.post('/:id/proof', validateToken, uploadProofMw.single('proof'), uploadProof)
router.put('/:id/cancel', validateToken, cancelOrder)

router.get('/', StaffAuth('manageOrders'), getOrders)
router.get('/:id', validateToken, getOrder)
router.delete('/:id', StaffAuth('manageOrders'), deleteOrder)
router.put('/:id', StaffAuth('manageOrders'), updateOrderStatus)

module.exports = router
