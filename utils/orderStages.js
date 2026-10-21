// Three order flows, three stage lists. Coffee/food is always prepared
// in-shop whether the customer is sitting at a table (dine_in) or ordered
// ahead from home to collect later (pickup) - same stages either way. A
// coffee-machine purchase is shipped like e-commerce (delivery). `Cancelled`
// is always allowed on top of these, but every other transition must go
// through one of these lists in order, and only staff (Admin/Manager with
// `manageOrders`) can move an order past its first stage - see
// updateOrderStatus in orderController.js.
const STAGES = {
    dine_in: ['Order Placed', 'Preparing', 'Ready for Pickup', 'Served'],
    pickup: ['Order Placed', 'Preparing', 'Ready for Pickup', 'Served'],
    delivery: ['Order Placed', 'Pending', 'Confirmed', 'Dispatched', 'Delivered'],
}

// First stage every order starts in, regardless of type - set automatically
// at checkout. Nothing beyond this happens without a staff confirmation.
const INITIAL_STATUS = 'Order Placed'

const isValidStatus = (orderType, status) =>
    status === 'Cancelled' || (STAGES[orderType] || []).includes(status)

const stagesFor = (orderType) => STAGES[orderType] || []

module.exports = { STAGES, INITIAL_STATUS, isValidStatus, stagesFor }
