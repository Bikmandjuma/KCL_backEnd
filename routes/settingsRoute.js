const { getPublicSettings, getSettings, updateSettings } = require('../controllers/settingsController')
const { StaffAuth } = require('../middlewares/validateTokenHandler')
const router = require('express').Router()

router.get('/public', getPublicSettings)
router.get('/', StaffAuth('manageSettings'), getSettings)
router.put('/', StaffAuth('manageSettings'), updateSettings)

module.exports = router
