const morgan = require('morgan')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const path = require('path')
const dotenv = require('dotenv').config()
const { connectDb } = require('./config/dbConnection')
require('./models') // load all Sequelize models + associations before syncing
const express = require('express')
const { notFound, errorHandler } = require('./middlewares/errorHandler')
const cors = require('cors')
const app = express()

const port = process.env.PORT || 5050
app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: false}))
app.use(cookieParser())
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

app.get('/', (req, res) => res.json({ msg: 'Kigali Coffee Lab API is running ☕' }))

app.use('/auth', require('./routes/authRoute'))
app.use('/users', require('./routes/userRoute'))
app.use('/products', require('./routes/productRoute'))
app.use('/drinks', require('./routes/drinkRoute'))
app.use('/carts', require('./routes/cartRoute'))
app.use('/orders', require('./routes/orderRoute'))
app.use('/settings', require('./routes/settingsRoute'))
app.use('/dashboard', require('./routes/dashboardRoute'))
app.use('/visits', require('./routes/visitRoute'))
app.use('/barista', require('./routes/baristaRoute'))

app.use(notFound)
app.use(errorHandler)

app.listen(port, ()=>{
    connectDb()
    console.log(`Listening to ${port}`);
})
