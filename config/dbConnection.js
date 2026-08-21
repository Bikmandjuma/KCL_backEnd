const { Sequelize } = require('sequelize')

// MySQL connection via Sequelize. Configure via .env:
// DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: false,
    }
)

const connectDb = async () => {
    try {
        await sequelize.authenticate()
        console.log(`connected to MySQL DB "${process.env.DB_NAME}"`)
        // Auto-create/alter tables to match models. Use migrations instead of
        // { alter: true } in a real production environment.
        await sequelize.sync({ alter: true })
        console.log('models synced')
    } catch (error) {
        console.log('Unable to connect to the database:', error.message)
    }
}

module.exports = { sequelize, connectDb }
