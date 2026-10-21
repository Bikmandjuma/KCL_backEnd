const { PrismaClient } = require('@prisma/client')

// Prisma reads the connection string from DATABASE_URL (see .env / .env_example).
const prisma = new PrismaClient()

const connectDb = async () => {
    try {
        await prisma.$connect()
        console.log('connected to MySQL DB via Prisma')
    } catch (error) {
        console.log('Unable to connect to the database:', error.message)
    }
}

module.exports = { prisma, connectDb }
