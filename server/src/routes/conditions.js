// POST /api/conditions → POST /Condition
// req.body: { patientId, encounterId, icd10Code, icd10Display, onsetDateTime }
const buildCondition = require('../builders/condition');
const createRoute = require('./createRoute');

module.exports = createRoute('Condition', buildCondition);
