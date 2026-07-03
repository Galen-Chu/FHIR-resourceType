// POST /api/organizations        → POST /Organization
// GET  /api/organizations/:id/patients → GET /Patient?organization={id}（查詢 A）
const fhirClient = require('../fhirClient');
const logger = require('../logger');
const buildOrganization = require('../builders/organization');
const createRoute = require('./createRoute');

const router = createRoute('Organization', buildOrganization);

router.get('/:id/patients', async (req, res) => {
  try {
    const r = await fhirClient.get('/Patient', {
      organization: `Organization/${req.params.id}`
    });

    if (r.status >= 200 && r.status < 300) {
      const entries = (r.data.entry || []).map((e) => {
        const p = e.resource || {};
        return {
          id: p.id,
          name: (p.name && p.name[0] && (p.name[0].text ||
            `${p.name[0].family || ''}${(p.name[0].given || []).join('')}`)) || '(未命名)',
          identifier: (p.identifier && p.identifier[0] && p.identifier[0].value) || '',
          gender: p.gender || '',
          birthDate: p.birthDate || '',
          active: p.active !== false
        };
      });
      res.json({ status: r.status, total: r.data.total ?? entries.length, patients: entries });
    } else {
      res.status(r.status).json({ status: r.status, outcome: r.data });
    }
  } catch (err) {
    logger.error('GET organization patients failed', { message: err.message });
    res.status(502).json({ status: 502, error: `FHIR Server 呼叫失敗：${err.message}` });
  }
});

module.exports = router;
