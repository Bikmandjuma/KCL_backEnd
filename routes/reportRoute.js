const { generateOrdersReport } = require('../controllers/reportController')
const { StaffAuth } = require('../middlewares/validateTokenHandler')
const router = require('express').Router()

router.get('/orders', StaffAuth('manageReports'), generateOrdersReport)

module.exports = router
