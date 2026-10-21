const {
    getActiveSessions, applyToTraining,
    getSessions, createSession, updateSession, deleteSession,
    getApplications, updateApplicationStatus,
} = require('../controllers/trainingController')
const { StaffAuth } = require('../middlewares/validateTokenHandler')
const router = require('express').Router()

// Public - the 4 Course pages each read this to show their countdown/seats
router.get('/active-sessions', getActiveSessions)
router.post('/apply', applyToTraining)

// Staff (manageTrainings permission)
router.get('/sessions', StaffAuth('manageTrainings'), getSessions)
router.post('/sessions', StaffAuth('manageTrainings'), createSession)
router.put('/sessions/:id', StaffAuth('manageTrainings'), updateSession)
router.delete('/sessions/:id', StaffAuth('manageTrainings'), deleteSession)

router.get('/applications', StaffAuth('manageTrainings'), getApplications)
router.put('/applications/:id', StaffAuth('manageTrainings'), updateApplicationStatus)

module.exports = router
