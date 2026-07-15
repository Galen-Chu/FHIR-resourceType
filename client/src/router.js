import { createRouter, createWebHistory } from 'vue-router';

import CreateOrganization from './views/CreateOrganization.vue';
import CreatePractitioner from './views/CreatePractitioner.vue';
import CreatePatient from './views/CreatePatient.vue';
import CreateEncounter from './views/CreateEncounter.vue';
import CreateCondition from './views/CreateCondition.vue';
import CreateObservation from './views/CreateObservation.vue';
import CreateMedicationRequest from './views/CreateMedicationRequest.vue';
import QueryByOrganization from './views/QueryByOrganization.vue';
import QueryByPatientId from './views/QueryByPatientId.vue';
import CdsHooks from './views/CdsHooks.vue';

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/organizations/create' },
    { path: '/organizations/create', component: CreateOrganization },
    { path: '/practitioners/create', component: CreatePractitioner },
    { path: '/patients/create', component: CreatePatient },
    { path: '/encounters/create', component: CreateEncounter },
    { path: '/conditions/create', component: CreateCondition },
    { path: '/observations/create', component: CreateObservation },
    { path: '/medication-requests/create', component: CreateMedicationRequest },
    { path: '/query/by-organization', component: QueryByOrganization },
    { path: '/query/by-patient-id', component: QueryByPatientId },
    { path: '/cds-hooks', component: CdsHooks }
  ]
});
