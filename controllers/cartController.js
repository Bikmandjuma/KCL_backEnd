const { prisma } = require('../config/dbConnection')
const { toClientJSON } = require('../utils/transform')

const recalcTotal = async (cartId) => {
    const items = await prisma.cartItem.findMany({ where: { cartId } })
    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    await prisma.cart.update({ where: { id: cartId }, data: { total } })
    return total
}

const getOrCreateCart = async (userId) => {
    let cart = await prisma.cart.findUnique({ where: { userId } })
    if (!cart) cart = await prisma.cart.create({ data: { userId } })
    return cart
}

exports.addItemToCart = async (req, res) => {
    const userId = req.user._id
    const productId = Number(req.body.productId)
    const quantity = Number(req.body.quantity)
    const { title, price, image } = req.body
    if (!productId)
        return res.status(400).send({ status: false, message: 'Invalid product' })

    const productAvailable = await prisma.product.findUnique({ where: { id: productId } })
    if (!productAvailable)
        return res.status(404).send({ status: false, message: 'Product not found' })
    if (productAvailable.quantity < quantity)
        return res.status(400).send({ status: false, message: `Only ${productAvailable.quantity} left in stock` })

    const cart = await getOrCreateCart(userId)
    const existing = await prisma.cartItem.findFirst({ where: { cartId: cart.id, productId } })
    if (existing) {
        await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: existing.quantity + quantity } })
    } else {
        await prisma.cartItem.create({ data: { cartId: cart.id, productId, quantity, title, image, price: Number(price) } })
    }
    await recalcTotal(cart.id)

    const updatedCart = await prisma.cart.findUnique({ where: { id: cart.id }, include: { products: true } })
    return res.status(200).send({ status: true, updatedCart: toClientJSON(updatedCart) })
}

exports.getCart = async (req, res) => {
    const userId = req.user._id
    const cart = await prisma.cart.findUnique({ where: { userId }, include: { products: true } })
    if (!cart)
        return res.status(200).send({ status: true, cart: { products: [], total: 0 }, cartCount: 0 })

    res.status(200).send({ status: true, cart: toClientJSON(cart), cartCount: cart.products.length })
}

exports.decreaseQuantity = async (req, res) => {
    const userId = req.user._id
    const productId = Number(req.body.productId)
    const quantity = Number(req.body.quantity)

    const cart = await prisma.cart.findUnique({ where: { userId } })
    if (!cart)
        return res.status(404).send({ status: false, message: 'Cart not found for this user' })

    const item = await prisma.cartItem.findFirst({ where: { cartId: cart.id, productId } })
    if (item) {
        const newQty = item.quantity - quantity
        if (newQty <= 0) await prisma.cartItem.delete({ where: { id: item.id } })
        else await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: newQty } })
        await recalcTotal(cart.id)
        const updatedCart = await prisma.cart.findUnique({ where: { id: cart.id }, include: { products: true } })
        return res.status(200).send({ status: true, updatedCart: toClientJSON(updatedCart) })
    }
    res.status(400).send({ status: false, message: 'Item does not exist in cart' })
}

exports.removeItem = async (req, res) => {
    const userId = req.user._id
    const productId = Number(req.body.productId)

    const cart = await prisma.cart.findUnique({ where: { userId } })
    if (!cart)
        return res.status(404).json({ status: false, message: 'Cart not found for this user' })

    const item = await prisma.cartItem.findFirst({ where: { cartId: cart.id, productId } })
    if (item) {
        await prisma.cartItem.delete({ where: { id: item.id } })
        await recalcTotal(cart.id)
        const updatedCart = await prisma.cart.findUnique({ where: { id: cart.id }, include: { products: true } })
        return res.status(200).json({ status: true, updatedCart: toClientJSON(updatedCart) })
    }
    return res.status(400).json({ status: false, message: 'Item does not exist in cart' })
}

exports.deleteCart = async (req, res) => {
    const userId = req.user._id
    try {
        const cart = await prisma.cart.findUnique({ where: { userId } })
        if (cart) {
            await prisma.cartItem.deleteMany({ where: { cartId: cart.id } })
            await prisma.cart.update({ where: { id: cart.id }, data: { total: 0 } })
        }
        res.status(200).json({ message: 'Products removed from the cart successfully.' })
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' })
    }
}
