const { logVisit } = require('../controllers/visitController')
const router = require('express').Router()

router.post('/', (req, res, next) => {
    // visits are tracked for everyone; token is optional here
    const auth = req.headers.authorization
    if (auth && auth.startsWith('Bearer')){
        const jwt = require('jsonwebtoken')
        jwt.verify(auth.split(' ')[1], process.env.JWT_KEY, (err, decoded)=>{
            if (!err) req.user = decoded
            next()
        })
    } else next()
}, logVisit)

module.exports = router
