// POST /api/medication-requests → POST /MedicationRequest
// req.body: { patientId, encounterId, practitionerId, medicationCode, medicationDisplay, dosageText }
const buildMedicationRequest = require('../builders/medicationRequest');
const createRoute = require('./createRoute');

module.exports = createRoute('MedicationRequest', buildMedicationRequest);
