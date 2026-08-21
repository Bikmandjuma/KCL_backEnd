const { getProducts, getProduct, getCategories, createProduct, updateProduct, deleteProduct, addToWishlist, rating, searchProducts } = require('../controllers/productController')
const { validateToken, StaffAuth } = require('../middlewares/validateTokenHandler')
const { uploadProductWithGallery } = require('../middlewares/uploadHandler')
const router = require('express').Router()

router.put('/wishlist', validateToken, addToWishlist)
router.put('/rating', validateToken, rating)

router.get('/', getProducts)
router.get('/search', searchProducts)
router.get('/categories', getCategories)
router.get('/:id', getProduct)

router.post('/', StaffAuth('manageProducts'), uploadProductWithGallery, createProduct)
router.put('/:id', StaffAuth('manageProducts'), uploadProductWithGallery, updateProduct)
router.delete('/:id', StaffAuth('manageProducts'), deleteProduct)

module.exports = router
