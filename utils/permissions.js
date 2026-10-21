// Default permission map for a brand-new Manager. Admin always has all
// permissions regardless of this object (enforced in middlewares/validateTokenHandler.js).
const defaultPermissions = {
    manageProducts: false,
    manageDrinks: false,
    manageOrders: false,
    manageUsers: false,
    manageSettings: false,
    viewDashboard: false,
    // Covers all 4 Coffee Training courses (Barista, Cupping/Sensory,
    // Roasting, CVA) - sessions/cohorts and applications alike.
    manageTrainings: false,
    // Tables, their QR codes, and table bookings/reservations.
    manageTables: false,
    // The public History page's employee stories + photo galleries.
    manageHistory: false,
    // Generating/downloading PDF reports (orders + analysis, by period).
    manageReports: false,
}

const allPermissions = Object.fromEntries(Object.keys(defaultPermissions).map((k) => [k, true]))

module.exports = { defaultPermissions, allPermissions }
