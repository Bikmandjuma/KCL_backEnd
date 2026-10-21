// Seed script: run with `node seed.js`
// Populates coffee machines (from PDF), KCL drink menu, default users and settings.
const dotenv = require('dotenv').config()
const slugify = require('slugify')
const CryptoJS = require('crypto-js')
const { prisma, connectDb } = require('./config/dbConnection')
const { allPermissions } = require('./utils/permissions')

const placeholder = (name, bg='2c1810', fg='f5ede4') =>
    `https://placehold.co/600x600/${bg}/${fg}?text=${encodeURIComponent(name)}`

const machines = [
    { title: 'Drip Coffee Machine', categories: 'Drip Coffee Machine', price: 85000, quantity: 12, desc: 'Classic automatic drip brewer, perfect for brewing multiple cups of clean, consistent coffee at home or in the office.' },
    { title: 'Espresso Machine', categories: 'Espresso Machine', price: 250000, quantity: 8, desc: 'Professional-grade espresso machine that pumps hot pressurized water through finely-ground coffee for a rich, bold shot.' },
    { title: 'Bean-to-Cup Automatic Espresso Machine', categories: 'Bean-to-Cup', price: 480000, quantity: 5, desc: 'Grinds fresh beans and brews espresso-based drinks at the touch of a button, barista quality, zero effort.' },
    { title: 'Capsule / Pod Machine', categories: 'Capsule/Pod Machine', price: 95000, quantity: 20, desc: 'Fast, mess-free brewing using pre-portioned coffee pods. Great for busy mornings.' },
    { title: 'French Press', categories: 'French Press', price: 22000, quantity: 30, desc: 'A manual immersion brewer that produces a full-bodied, rich cup, a Kigali Coffee Lab favourite.' },
    { title: 'Moka Pot', categories: 'Moka Pot', price: 18000, quantity: 25, desc: 'Stovetop brewer that produces strong, espresso-like coffee using steam pressure.' },
    { title: 'Pour-Over Machine', categories: 'Pour-Over Machine', price: 35000, quantity: 18, desc: 'Manual dripper for a clean, bright cup with total control over your brew (Chemex/V60 style).' },
    { title: 'AeroPress', categories: 'AeroPress', price: 28000, quantity: 22, desc: 'Portable, versatile brewer that uses air pressure for a smooth, low-acid cup in under a minute.' },
    { title: 'Cold Brew Machine', categories: 'Cold Brew Machine', price: 65000, quantity: 10, desc: 'Steeps coarse grounds in cold water for hours to produce a smooth, naturally sweet concentrate.' },
    { title: 'Percolator', categories: 'Percolator', price: 40000, quantity: 14, desc: 'A traditional brewer that continuously cycles boiling water through grounds for a strong, classic cup.' },
    { title: 'Siphon / Vacuum Coffee Maker', categories: 'Siphon/Vacuum', price: 120000, quantity: 6, desc: 'A theatrical vapor-pressure brewer producing a clean, tea-like cup, a showpiece for any coffee bar.' },
    { title: 'Turkish Coffee Machine', categories: 'Turkish Coffee Machine', price: 55000, quantity: 9, desc: 'Traditional cezve-style brewer for thick, unfiltered, deeply aromatic Turkish coffee.' },
    { title: 'Commercial Coffee Machine', categories: 'Commercial', price: 1450000, quantity: 3, desc: 'High-volume, high-durability machine built for cafés and restaurants like Kigali Coffee Lab.' },
    { title: 'Super-Automatic Machine', categories: 'Super-Automatic', price: 620000, quantity: 4, desc: 'Grinds, tamps, brews, and even froths milk automatically for the ultimate convenience.' },
    { title: 'Semi-Automatic Espresso Machine', categories: 'Semi-Automatic Espresso', price: 320000, quantity: 7, desc: 'Gives baristas full manual control over extraction while automating water delivery.' },
    { title: 'Lever Espresso Machine', categories: 'Lever Espresso Machine', price: 410000, quantity: 5, desc: 'Manual, spring-piston lever machine loved by purists for its hands-on, artisanal extraction.' },
]

const drinks = [
    { name: 'Americano', price: 4500, type: 'coffee', category: 'Hot Drinks', desc: 'Espresso shots topped with hot water for a light, smooth cup.' },
    { name: 'Espresso', price: 3500, type: 'coffee', category: 'Hot Drinks', desc: 'A concentrated shot of pure, bold coffee.' },
    { name: 'Espresso Machiatto', price: 4000, type: 'coffee', category: 'Hot Drinks', desc: 'Espresso "stained" with a dash of foamed milk.' },
    { name: 'Pour Over (Chemex/V60)', price: 5000, type: 'coffee', category: 'Hot Drinks', desc: 'Hand-poured, hand-crafted clean-cup coffee brewed to order.' },
    { name: 'Aeropress', price: 5000, type: 'coffee', category: 'Hot Drinks', desc: 'Smooth, rich, low-acid coffee brewed fresh in front of you.' },
    { name: 'French Press', price: 5000, type: 'coffee', category: 'Hot Drinks', desc: 'Full-bodied, immersion-brewed coffee, served in its own press.' },
    { name: 'Cappuccino', price: 4200, type: 'coffee', category: 'Hot Drinks', desc: 'Equal parts espresso, steamed milk and velvety micro-foam.' },
    { name: 'Flat White', price: 4300, type: 'coffee', category: 'Hot Drinks', desc: 'A double espresso with steamed milk and a thin layer of microfoam.' },
    { name: 'Turkish Coffee', price: 4000, type: 'coffee', category: 'Hot Drinks', desc: 'Finely ground coffee slow-brewed unfiltered, rich and aromatic.' },
    { name: 'Iced Latte', price: 4800, type: 'coffee', category: 'Cold Drinks', desc: 'Espresso over ice with cold milk, smooth and refreshing.' },
    { name: 'Cold Brew', price: 4800, type: 'coffee', category: 'Cold Drinks', desc: 'Slow-steeped for a smooth, naturally sweet, low-acid cup, served cold.' },
    { name: 'Iced Americano', price: 4200, type: 'coffee', category: 'Cold Drinks', desc: 'Espresso and cold water over ice, crisp and clean.' },
    { name: 'Affogato', price: 5200, type: 'coffee', category: 'Specialty', desc: 'A scoop of vanilla ice cream "drowned" in a hot shot of espresso.' },
    { name: 'Caramel Macchiato', price: 5000, type: 'coffee', category: 'Specialty', desc: 'Espresso marked with steamed milk, vanilla and caramel drizzle.' },
    { name: 'Butter Croissant', price: 2000, type: 'food', category: 'Pastries', desc: 'Flaky, buttery croissant baked fresh every morning.' },
    { name: 'Banana Bread Slice', price: 1800, type: 'food', category: 'Pastries', desc: 'Moist banana bread with a hint of cinnamon.' },
    { name: 'Chocolate Muffin', price: 2200, type: 'food', category: 'Pastries', desc: 'Rich chocolate chip muffin, baked in-house.' },
    { name: 'Cinnamon Roll', price: 2500, type: 'food', category: 'Pastries', desc: 'Warm, gooey cinnamon roll with a light glaze.' },
    { name: 'Blueberry Scone', price: 2300, type: 'food', category: 'Pastries', desc: 'A buttery scone studded with fresh blueberries.' },
    { name: 'Almond Croissant', price: 2600, type: 'food', category: 'Pastries', desc: 'Twice-baked croissant filled with almond cream.' },
    { name: 'Doughnut (Glazed)', price: 1500, type: 'food', category: 'Pastries', desc: 'Classic soft glazed doughnut.' },
    { name: 'Chicken Sandwich', price: 4500, type: 'food', category: 'Sandwiches', desc: 'Grilled chicken, lettuce and house sauce in toasted bread.' },
    { name: 'Veggie Panini', price: 4000, type: 'food', category: 'Sandwiches', desc: 'Grilled vegetables and cheese pressed in ciabatta.' },
    { name: 'Club Sandwich', price: 5000, type: 'food', category: 'Sandwiches', desc: 'Triple-decker with chicken, bacon, egg, lettuce and tomato.' },
    { name: 'Egg & Cheese Sandwich', price: 3200, type: 'food', category: 'Sandwiches', desc: 'Fried egg and melted cheese on toasted bread.' },
    { name: 'Ham & Cheese Croissant', price: 3800, type: 'food', category: 'Sandwiches', desc: 'Flaky croissant filled with ham and melted cheese.' },
    { name: 'Avocado Toast', price: 4200, type: 'food', category: 'Sandwiches', desc: 'Smashed avocado on toasted sourdough with a hint of chili.' },
]

const tables = [
    { label: 'Table 1', capacity: 2 },
    { label: 'Table 2', capacity: 2 },
    { label: 'Table 3', capacity: 4 },
    { label: 'Table 4', capacity: 4 },
    { label: 'Table 5', capacity: 6 },
    { label: 'Table 6 (Outdoor)', capacity: 4 },
]

const run = async () => {
    await connectDb()

    // Settings singleton
    let settings = await prisma.settings.findFirst()
    if (!settings) {
        settings = await prisma.settings.create({ data: {} })
        console.log('Created default settings')
    }

    // Default Admin
    let admin = await prisma.user.findUnique({ where: { email: 'admin@kigalicoffeelab.com' } })
    if (!admin) {
        admin = await prisma.user.create({
            data: {
                username: 'kcl_admin',
                email: 'admin@kigalicoffeelab.com',
                password: CryptoJS.AES.encrypt('Admin@123', process.env.PASSWORD_KEY).toString(),
                role: 'admin',
                isAdmin: true,
                permissions: allPermissions,
            },
        })
        console.log('Created default admin -> admin@kigalicoffeelab.com / Admin@123')
    }

    // Default Manager (limited permissions example)
    let manager = await prisma.user.findUnique({ where: { email: 'manager@kigalicoffeelab.rw' } })
    if (!manager) {
        manager = await prisma.user.create({
            data: {
                username: 'kcl_manager',
                email: 'manager@kigalicoffeelab.rw',
                password: CryptoJS.AES.encrypt('Manager@123', process.env.PASSWORD_KEY).toString(),
                role: 'manager',
                isAdmin: false,
                permissions: {
                    manageProducts: true, manageDrinks: true, manageOrders: true,
                    manageUsers: false, manageSettings: false, viewDashboard: true,
                    manageTrainings: true, manageTables: true, manageHistory: true,
                },
            },
        })
        console.log('Created default manager -> manager@kigalicoffeelab.rw / Manager@123')
    }

    // Default open training sessions - one per course (Barista is local/no
    // level; Cupping, Roasting and CVA each open at the Foundation level).
    const trainingSessions = [
        {
            courseType: 'barista', level: null,
            title: '2026 Cohort 1', description: 'An 8-week hands-on program covering grinding, dosing, extraction, milk steaming, and latte art at Kigali Coffee Lab.',
            capacity: 20,
        },
        {
            courseType: 'cupping', level: 'Foundation',
            title: '2026 Cohort 1 - Foundation', description: 'An introduction to sensory evaluation: aroma, flavor, acidity, sweetness, body and aftertaste, building toward the Q Grader pathway.',
            capacity: 15,
        },
        {
            courseType: 'roasting', level: 'Foundation',
            title: '2026 Cohort 1 - Foundation', description: 'From green bean to golden roast: heat control, roast profiles, and sensory evaluation of the roasted cup.',
            capacity: 12,
        },
        {
            courseType: 'cva', level: 'Foundation',
            title: '2026 Cohort 1 - Foundation', description: 'Coffee Value Assessment: understanding extrinsic attributes (origin, variety, processing, certifications) alongside sensory evaluation.',
            capacity: 15,
        },
    ]
    const existingSession = await prisma.trainingSession.findFirst()
    if (!existingSession) {
        for (const s of trainingSessions) {
            await prisma.trainingSession.create({ data: { ...s, active: true } })
        }
        console.log(`Created ${trainingSessions.length} default open training sessions (one per course)`)
    }

    // A couple of sample staff stories for the History page
    const staffStories = [
        {
            employeeName: 'Aline Uwase', roleTitle: 'Head Barista',
            story: 'Aline joined Kigali Coffee Lab as a trainee in our very first barista cohort and now leads our bar team. She specialises in latte art and mentors every new trainee who comes through our doors.',
        },
        {
            employeeName: 'Eric Niyonsenga', roleTitle: 'Master Roaster',
            story: 'Eric has roasted coffee for over six years, starting on a small drum roaster and now running our full roasting program. He trains our roasting cohort students hands-on, batch by batch.',
        },
    ]
    const existingStory = await prisma.staffStory.findFirst()
    if (!existingStory) {
        for (let i = 0; i < staffStories.length; i++) {
            await prisma.staffStory.create({
                data: { ...staffStories[i], coverImage: placeholder(staffStories[i].employeeName, '4a2c1d', 'f5ede4'), gallery: [], sortOrder: i },
            })
        }
        console.log(`Created ${staffStories.length} sample staff stories`)
    }

    // Machines
    for (const m of machines) {
        const exists = await prisma.product.findFirst({ where: { title: m.title } })
        if (!exists) {
            await prisma.product.create({
                data: {
                    ...m,
                    slug: slugify(m.title + '-' + Date.now() + Math.floor(Math.random()*1000), { lower: true }),
                    color: 'Black',
                    image: placeholder(m.title),
                    gallery: [],
                    listedById: admin.id,
                },
            })
        }
    }
    console.log(`Seeded ${machines.length} coffee machines`)

    // Drinks
    for (const d of drinks) {
        const exists = await prisma.drink.findFirst({ where: { name: d.name } })
        if (!exists) {
            await prisma.drink.create({ data: { ...d, image: placeholder(d.name, '4a2c1d', 'f5ede4'), listedById: admin.id } })
        }
    }
    console.log(`Seeded ${drinks.length} drinks`)

    // Tables
    for (const t of tables) {
        const exists = await prisma.table.findFirst({ where: { label: t.label } })
        if (!exists) await prisma.table.create({ data: t })
    }
    console.log(`Seeded ${tables.length} tables`)

    console.log('Seeding complete ✅')
    await prisma.$disconnect()
    process.exit(0)
}

run().catch(async (e)=>{ console.error(e); await prisma.$disconnect(); process.exit(1) })
