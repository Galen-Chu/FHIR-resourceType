// POST /api/observations → POST /Observation
// req.body: { patientId, encounterId, loincCode, loincDisplay, value, unit }
const buildObservation = require('../builders/observation');
const createRoute = require('./createRoute');

module.exports = createRoute('Observation', buildObservation);
