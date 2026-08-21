const { getUsers, getUser, updateUser, deleteUser, getWishlist, saveUserAddress, createStaff, updateStaff } = require('../controllers/userController')
const { validateTokenAndAuth, AdminAuth, validateToken, StaffAuth } = require('../middlewares/validateTokenHandler')
const router = require('express').Router()

router.get('/', StaffAuth('manageUsers'), getUsers)

router.get('/wishlist', validateToken, getWishlist)

router.put('/save-address', validateToken, saveUserAddress)

// Admin: staff/role management
router.post('/staff', AdminAuth, createStaff)
router.put('/staff/:id', AdminAuth, updateStaff)

router.get('/:id', validateTokenAndAuth, getUser)
router.put('/:id', validateTokenAndAuth, updateUser)
router.delete('/:id', validateTokenAndAuth, deleteUser)

module.exports = router
