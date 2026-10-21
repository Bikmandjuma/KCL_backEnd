const { getDashboardStats, getNavCounts } = require('../controllers/dashboardController')
const { StaffAuth, AnyStaffAuth } = require('../middlewares/validateTokenHandler')
const router = require('express').Router()

router.get('/', StaffAuth('viewDashboard'), getDashboardStats)
router.get('/nav-counts', AnyStaffAuth, getNavCounts)

module.exports = router
