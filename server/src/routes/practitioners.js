// POST /api/practitioners → POST /Practitioner
const buildPractitioner = require('../builders/practitioner');
const createRoute = require('./createRoute');

module.exports = createRoute('Practitioner', buildPractitioner);
