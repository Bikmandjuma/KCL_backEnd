const multer = require('multer')
const path = require('path')
const fs = require('fs')

const makeStorage = (folder) => {
    const dir = path.join(__dirname, '..', 'uploads', folder)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    return multer.diskStorage({
        destination: (req, file, cb) => cb(null, dir),
        filename: (req, file, cb) => {
            const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
            cb(null, unique + path.extname(file.originalname))
        }
    })
}

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only image files are allowed'), false)
}

const uploadProduct = multer({ storage: makeStorage('products'), fileFilter, limits: { fileSize: 5 * 1024 * 1024 } })
const uploadDrink = multer({ storage: makeStorage('drinks'), fileFilter, limits: { fileSize: 5 * 1024 * 1024 } })
const uploadProof = multer({ storage: makeStorage('proofs'), fileFilter, limits: { fileSize: 5 * 1024 * 1024 } })

// Product create/update accepts one primary `image` plus up to 5 extra
// `gallery` images, which power the auto-rotating card carousel on the
// storefront (a product with only one image stays static).
const uploadProductWithGallery = uploadProduct.fields([
    { name: 'image', maxCount: 1 },
    { name: 'gallery', maxCount: 5 },
])

module.exports = { uploadProduct, uploadDrink, uploadProof, uploadProductWithGallery }
