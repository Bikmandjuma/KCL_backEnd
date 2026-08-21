const {
    getActiveSession, applyToBarista,
    getSessions, createSession, updateSession, deleteSession,
    getApplications, updateApplicationStatus,
} = require('../controllers/baristaController')
const { StaffAuth } = require('../middlewares/validateTokenHandler')
const router = require('express').Router()

// Public
router.get('/active-session', getActiveSession)
router.post('/apply', applyToBarista)

// Staff (manageBarista permission)
router.get('/sessions', StaffAuth('manageBarista'), getSessions)
router.post('/sessions', StaffAuth('manageBarista'), createSession)
router.put('/sessions/:id', StaffAuth('manageBarista'), updateSession)
router.delete('/sessions/:id', StaffAuth('manageBarista'), deleteSession)

router.get('/applications', StaffAuth('manageBarista'), getApplications)
router.put('/applications/:id', StaffAuth('manageBarista'), updateApplicationStatus)

module.exports = router
