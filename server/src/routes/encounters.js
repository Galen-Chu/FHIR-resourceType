// POST /api/encounters → POST /Encounter
// req.body: { patientId, organizationId, practitionerId, status, periodStart, periodEnd }
const buildEncounter = require('../builders/encounter');
const createRoute = require('./createRoute');

module.exports = createRoute('Encounter', buildEncounter);
