const { searchAll } = require('../controllers/searchController')
const router = require('express').Router()

// Public - unified search across products (machines) and menu (coffee/food)
router.get('/', searchAll)

module.exports = router
