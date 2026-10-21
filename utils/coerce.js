// Sequelize used to silently cast strings from multipart/form-data bodies
// ("5" -> 5, "true" -> true) into the right column type. Prisma does not -
// it throws if you hand it a string where a Float/Int/Boolean is expected.
// These two helpers do that coercion explicitly wherever a value might have
// come from a form field (price, quantity, capacity, featured, active...).
const toNumber = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v))
const toBool = (v) => (v === undefined ? undefined : v === true || v === 'true')

module.exports = { toNumber, toBool }
