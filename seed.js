// Seed script: run with `node seed.js`
// Populates coffee machines (from PDF), KCL drink menu, default users and settings.
const dotenv = require('dotenv').config()
const slugify = require('slugify')
const CryptoJS = require('crypto-js')
const { connectDb } = require('./config/dbConnection')
const { User, Product, Drink, Settings, BaristaSession } = require('./models')

const placeholder = (name, bg='2c1810', fg='f5ede4') =>
    `https://placehold.co/600x600/${bg}/${fg}?text=${encodeURIComponent(name)}`

const machines = [
    { title: 'Drip Coffee Machine', categories: 'Drip Coffee Machine', price: 85000, quantity: 12, desc: 'Classic automatic drip brewer, perfect for brewing multiple cups of clean, consistent coffee at home or in the office.' },
    { title: 'Espresso Machine', categories: 'Espresso Machine', price: 250000, quantity: 8, desc: 'Professional-grade espresso machine that pumps hot pressurized water through finely-ground coffee for a rich, bold shot.' },
    { title: 'Bean-to-Cup Automatic Espresso Machine', categories: 'Bean-to-Cup', price: 480000, quantity: 5, desc: 'Grinds fresh beans and brews espresso-based drinks at the touch of a button — barista quality, zero effort.' },
    { title: 'Capsule / Pod Machine', categories: 'Capsule/Pod Machine', price: 95000, quantity: 20, desc: 'Fast, mess-free brewing using pre-portioned coffee pods. Great for busy mornings.' },
    { title: 'French Press', categories: 'French Press', price: 22000, quantity: 30, desc: 'A manual immersion brewer that produces a full-bodied, rich cup — a Kigali Coffee Lab favourite.' },
    { title: 'Moka Pot', categories: 'Moka Pot', price: 18000, quantity: 25, desc: 'Stovetop brewer that produces strong, espresso-like coffee using steam pressure.' },
    { title: 'Pour-Over Machine', categories: 'Pour-Over Machine', price: 35000, quantity: 18, desc: 'Manual dripper for a clean, bright cup — total control over your brew (Chemex/V60 style).' },
    { title: 'AeroPress', categories: 'AeroPress', price: 28000, quantity: 22, desc: 'Portable, versatile brewer that uses air pressure for a smooth, low-acid cup in under a minute.' },
    { title: 'Cold Brew Machine', categories: 'Cold Brew Machine', price: 65000, quantity: 10, desc: 'Steeps coarse grounds in cold water for hours to produce a smooth, naturally sweet concentrate.' },
    { title: 'Percolator', categories: 'Percolator', price: 40000, quantity: 14, desc: 'A traditional brewer that continuously cycles boiling water through grounds for a strong, classic cup.' },
    { title: 'Siphon / Vacuum Coffee Maker', categories: 'Siphon/Vacuum', price: 120000, quantity: 6, desc: 'A theatrical vapor-pressure brewer producing a clean, tea-like cup — a showpiece for any coffee bar.' },
    { title: 'Turkish Coffee Machine', categories: 'Turkish Coffee Machine', price: 55000, quantity: 9, desc: 'Traditional cezve-style brewer for thick, unfiltered, deeply aromatic Turkish coffee.' },
    { title: 'Commercial Coffee Machine', categories: 'Commercial', price: 1450000, quantity: 3, desc: 'High-volume, high-durability machine built for cafés and restaurants like Kigali Coffee Lab.' },
    { title: 'Super-Automatic Machine', categories: 'Super-Automatic', price: 620000, quantity: 4, desc: 'Grinds, tamps, brews, and even froths milk automatically — the ultimate convenience machine.' },
    { title: 'Semi-Automatic Espresso Machine', categories: 'Semi-Automatic Espresso', price: 320000, quantity: 7, desc: 'Gives baristas full manual control over extraction while automating water delivery.' },
    { title: 'Lever Espresso Machine', categories: 'Lever Espresso Machine', price: 410000, quantity: 5, desc: 'Manual, spring-piston lever machine loved by purists for its hands-on, artisanal extraction.' },
]

const drinks = [
    { name: 'Americano', price: 4500, category: 'Hot Drinks', desc: 'Espresso shots topped with hot water for a light, smooth cup.' },
    { name: 'Espresso', price: 3500, category: 'Hot Drinks', desc: 'A concentrated shot of pure, bold coffee.' },
    { name: 'Espresso Machiatto', price: 4000, category: 'Hot Drinks', desc: 'Espresso "stained" with a dash of foamed milk.' },
    { name: 'Pour Over (Chemex/V60)', price: 5000, category: 'Hot Drinks', desc: 'Hand-poured, hand-crafted clean-cup coffee brewed to order.' },
    { name: 'Aeropress', price: 5000, category: 'Hot Drinks', desc: 'Smooth, rich, low-acid coffee brewed fresh in front of you.' },
    { name: 'French Press', price: 5000, category: 'Hot Drinks', desc: 'Full-bodied, immersion-brewed coffee, served in its own press.' },
]

const run = async () => {
    await connectDb() // connects + syncs tables

    // Settings singleton
    let settings = await Settings.findOne()
    if (!settings) {
        settings = await Settings.create({})
        console.log('Created default settings')
    }

    // Default Admin
    let admin = await User.findOne({ where: { email: 'admin@kigalicoffeelab.rw' } })
    if (!admin) {
        admin = await User.create({
            username: 'kcl_admin',
            email: 'admin@kigalicoffeelab.rw',
            password: CryptoJS.AES.encrypt('Admin@123', process.env.PASSWORD_KEY).toString(),
            role: 'admin',
            isAdmin: true,
            permissions: {
                manageProducts: true, manageDrinks: true, manageOrders: true,
                manageUsers: true, manageSettings: true, viewDashboard: true, manageBarista: true
            }
        })
        console.log('Created default admin -> admin@kigalicoffeelab.rw / Admin@123')
    }

    // Default Manager (limited permissions example)
    let manager = await User.findOne({ where: { email: 'manager@kigalicoffeelab.rw' } })
    if (!manager) {
        manager = await User.create({
            username: 'kcl_manager',
            email: 'manager@kigalicoffeelab.rw',
            password: CryptoJS.AES.encrypt('Manager@123', process.env.PASSWORD_KEY).toString(),
            role: 'manager',
            isAdmin: false,
            permissions: {
                manageProducts: true, manageDrinks: true, manageOrders: true,
                manageUsers: false, manageSettings: false, viewDashboard: true, manageBarista: true
            }
        })
        console.log('Created default manager -> manager@kigalicoffeelab.rw / Manager@123')
    }

    // Default open barista training session
    const existingSession = await BaristaSession.findOne()
    if (!existingSession) {
        await BaristaSession.create({
            title: 'Barista Foundations - Cohort 1',
            description: 'An 8-week hands-on program covering grinding, dosing, extraction, milk steaming, and latte art at Kigali Coffee Lab.',
            capacity: 20,
            active: true,
        })
        console.log('Created default open barista training session')
    }

    // Machines
    for (const m of machines) {
        const exists = await Product.findOne({ where: { title: m.title } })
        if (!exists) {
            await Product.create({
                ...m,
                slug: slugify(m.title + '-' + Date.now() + Math.floor(Math.random()*1000), { lower: true }),
                color: 'Black',
                image: placeholder(m.title),
                listedById: admin.id,
            })
        }
    }
    console.log(`Seeded ${machines.length} coffee machines`)

    // Drinks
    for (const d of drinks) {
        const exists = await Drink.findOne({ where: { name: d.name } })
        if (!exists) {
            await Drink.create({ ...d, image: placeholder(d.name, '4a2c1d', 'f5ede4'), listedById: admin.id })
        }
    }
    console.log(`Seeded ${drinks.length} drinks`)

    console.log('Seeding complete ✅')
    process.exit(0)
}

run().catch((e)=>{ console.error(e); process.exit(1) })
