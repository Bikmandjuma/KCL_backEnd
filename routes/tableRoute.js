const {
    getTables, getTable, createTable, updateTable, deleteTable, downloadTableQr, getTableByQr,
    createBooking, getBookings, updateBooking,
} = require('../controllers/tableController')
const { StaffAuth } = require('../middlewares/validateTokenHandler')
const router = require('express').Router()

// Public - so the app can show customers a table picker, and so a scanned
// QR code resolves to its table (before any table-id routes below, so
// "scan"/"bookings" never get swallowed by the :id route).
router.get('/scan/:qrToken', getTableByQr)

router.post('/bookings', createBooking)
router.get('/bookings', StaffAuth('manageTables'), getBookings)
router.put('/bookings/:id', StaffAuth('manageTables'), updateBooking)

router.get('/', getTables)
router.get('/:id', getTable)
router.get('/:id/qr', StaffAuth('manageTables'), downloadTableQr)

// Public - both Admin/Manager AND a customer mid-checkout can add a table
// (e.g. the shop has more physical tables than the app knows about yet).
// Editing/removing an existing table stays staff-only, to stop a customer
// from tampering with tables already in use.
router.post('/', createTable)
router.put('/:id', StaffAuth('manageTables'), updateTable)
router.delete('/:id', StaffAuth('manageTables'), deleteTable)

module.exports = router
