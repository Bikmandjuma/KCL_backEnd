const { getDashboardStats } = require('../controllers/dashboardController')
const { StaffAuth } = require('../middlewares/validateTokenHandler')
const router = require('express').Router()

router.get('/', StaffAuth('viewDashboard'), getDashboardStats)

module.exports = router
