const { getStories, getStory, createStory, updateStory, deleteStory } = require('../controllers/staffStoryController')
const { StaffAuth } = require('../middlewares/validateTokenHandler')
const { uploadStaffStory } = require('../middlewares/uploadHandler')
const router = require('express').Router()

// Public - the History page
router.get('/', getStories)
router.get('/:id', getStory)

// Staff (manageHistory permission)
router.post('/', StaffAuth('manageHistory'), uploadStaffStory, createStory)
router.put('/:id', StaffAuth('manageHistory'), uploadStaffStory, updateStory)
router.delete('/:id', StaffAuth('manageHistory'), deleteStory)

module.exports = router
