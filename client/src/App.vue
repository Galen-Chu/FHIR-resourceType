<template>
  <nav class="sidebar">
    <h1>FHIR 交換測試系統</h1>

    <div class="group-title">建立資源</div>
    <router-link to="/organizations/create">Organization</router-link>
    <router-link to="/practitioners/create">Practitioner</router-link>
    <router-link to="/patients/create">Patient</router-link>
    <router-link to="/encounters/create">Encounter</router-link>
    <router-link to="/conditions/create">Condition</router-link>
    <router-link to="/observations/create">Observation</router-link>
    <router-link to="/medication-requests/create">MedicationRequest</router-link>

    <div class="group-title">查詢</div>
    <router-link to="/query/by-organization">依機構查病患</router-link>
    <router-link to="/query/by-patient-id">依 ID 查病患</router-link>
  </nav>

  <main class="main">
    <router-view />
  </main>
</template>
