const { getDrinks, getDrink, createDrink, updateDrink, deleteDrink } = require('../controllers/drinkController')
const { StaffAuth } = require('../middlewares/validateTokenHandler')
const { uploadDrink } = require('../middlewares/uploadHandler')
const router = require('express').Router()

router.get('/', getDrinks)
router.get('/:id', getDrink)

router.post('/', StaffAuth('manageDrinks'), uploadDrink.single('image'), createDrink)
router.put('/:id', StaffAuth('manageDrinks'), uploadDrink.single('image'), updateDrink)
router.delete('/:id', StaffAuth('manageDrinks'), deleteDrink)

module.exports = router
