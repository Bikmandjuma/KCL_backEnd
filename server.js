const morgan = require('morgan')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const path = require('path')
const dotenv = require('dotenv').config()
const { connectDb } = require('./config/dbConnection')
const express = require('express')
const { notFound, errorHandler } = require('./middlewares/errorHandler')
const cors = require('cors')
const app = express()

const port = process.env.PORT || 4000
app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: false}))
app.use(cookieParser())
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

app.get('/', (req, res) => res.json({ msg: 'Kigali Coffee Lab API is running ☕' }))

app.use('/auth', require('./routes/authRoute'))
app.use('/users', require('./routes/userRoute'))
app.use('/products', require('./routes/productRoute'))
// /menu is the catalog-facing name for the same coffee+food items /drinks
// serves - kept as an alias so nothing that already calls /drinks breaks.
app.use('/drinks', require('./routes/drinkRoute'))
app.use('/menu', require('./routes/drinkRoute'))
app.use('/carts', require('./routes/cartRoute'))
app.use('/orders', require('./routes/orderRoute'))
app.use('/tables', require('./routes/tableRoute'))
app.use('/notifications', require('./routes/notificationRoute'))
app.use('/settings', require('./routes/settingsRoute'))
app.use('/dashboard', require('./routes/dashboardRoute'))
app.use('/visits', require('./routes/visitRoute'))
app.use('/training', require('./routes/trainingRoute'))
app.use('/staff-stories', require('./routes/staffStoryRoute'))
app.use('/search', require('./routes/searchRoute'))
app.use('/reports', require('./routes/reportRoute'))

app.use(notFound)
app.use(errorHandler)

app.listen(port, ()=>{
    connectDb()
    console.log(`Listening to ${port}`);
})
