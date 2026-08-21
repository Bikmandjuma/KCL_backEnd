const jwt = require('jsonwebtoken')

const validateToken = (req,res,next)=>{
    const authHeader = req.headers.Authorization || req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer')){
        const token = authHeader.split(' ')[1]
        jwt.verify(token, process.env.JWT_KEY, (err, decoded)=>{
        if (err){
            return res.status(401).json('Token is not Valid')
        }
        if (!err){
            req.user = decoded
            next()
        }

    })
    }
    else{
        return res.status(401).json('You are not authenticated')
    }

}

const validateTokenAndAuth = (req,res,next)=>{
    validateToken(req,res,()=>{
        if (req.user._id == req.params.id || req.user.isAdmin){
            next()
        }else{
            res.status(400).json('You do not have the permission')
        }
    })
}

// Only the Admin role may pass
const AdminAuth = (req,res,next)=>{
    validateToken(req,res,()=>{
        if (req.user.isAdmin || req.user.role === 'admin'){
            next()
        }else{
            res.status(403).json({ msg: 'Only Admin has Access' })
        }
    })
}

// Admin OR a Manager who has been explicitly granted `permission`
const StaffAuth = (permission) => (req, res, next) => {
    validateToken(req, res, () => {
        if (req.user.isAdmin || req.user.role === 'admin') return next()
        if (req.user.role === 'manager' && req.user.permissions && req.user.permissions[permission]) {
            return next()
        }
        return res.status(403).json({ msg: `You do not have '${permission}' permission` })
    })
}

module.exports = { validateToken, validateTokenAndAuth, AdminAuth, StaffAuth }
