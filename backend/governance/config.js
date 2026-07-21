module.exports={
 caseType:'accountable_nonprofit_field_case',initialState:'intake_registered',
 states:['intake_registered','eligibility_consent_verified','service_plan_approved','referral_owned','volunteer_matched','shift_confirmed','service_in_progress','exception_recovery','outcome_review','closed'],
 createRoles:['caseworker','coordinator'],assessmentRoles:['caseworker','coordinator','safeguarding_officer','volunteer_supervisor'],auditRoles:['administrator','finance','safeguarding_officer','board_auditor'],connectorRoles:['integration_operator','administrator'],
 evidenceKinds:['intake_digest','duplicate_check','eligibility_record','consent_receipt','restricted_note_pointer','service_plan','referral_receipt','volunteer_onboarding','credential_check','availability_snapshot','shift_assignment','confirmation_receipt','checkin_receipt','no_show_record','supervision_record','hours_approval','outcome_record','grant_restriction','donation_designation','inventory_custody','incident_safeguarding','message_delivery','offline_sync_receipt','closure_record'],
 requiredSignals:['caseVersion','consentVerified','eligibilityStatus','urgency','duplicateStatus','volunteerStatus','messageStatus','offlineSyncStatus','restrictionStatus','policyVersion'],
 professionalBoundary:'This workflow supports accountable field operations; qualified staff decide eligibility, safeguarding, services, finance, grants, and closure, and emergency services handle immediate danger.',
 connectors:[{name:'sms_email',purpose:'consented delivery receipts'},{name:'mapping',purpose:'approved location references'},{name:'background_check',purpose:'credential status receipts'},{name:'donor_crm',purpose:'designation references'},{name:'grant_accounting',purpose:'restriction and ledger receipts'},{name:'document_storage',purpose:'encrypted restricted records'},{name:'partner_referral',purpose:'signed referral status'}],
 transitions:[
  {from:'intake_registered',action:'verify_eligibility_consent',to:'eligibility_consent_verified',roles:['caseworker','coordinator'],requiresEvidence:true},
  {from:'eligibility_consent_verified',action:'approve_service_plan',to:'service_plan_approved',roles:['coordinator'],requiresEvidence:true,dualControl:true},
  {from:'service_plan_approved',action:'assign_referral',to:'referral_owned',roles:['caseworker'],requiresEvidence:true},
  {from:'referral_owned',action:'match_volunteer',to:'volunteer_matched',roles:['volunteer_supervisor'],requiresEvidence:true},
  {from:'volunteer_matched',action:'confirm_shift',to:'shift_confirmed',roles:['coordinator','volunteer_supervisor'],requiresEvidence:true,dualControl:true},
  {from:'shift_confirmed',action:'record_checkin',to:'service_in_progress',roles:['caseworker','volunteer_supervisor'],requiresEvidence:true},
  {from:'service_in_progress',action:'open_exception',to:'exception_recovery',roles:['caseworker','safeguarding_officer'],requiresEvidence:true},
  {from:'service_in_progress',action:'review_outcome',to:'outcome_review',roles:['caseworker','coordinator'],requiresEvidence:true,dualControl:true},
  {from:'exception_recovery',action:'review_outcome',to:'outcome_review',roles:['coordinator','safeguarding_officer'],requiresEvidence:true,dualControl:true},
  {from:'outcome_review',action:'close',to:'closed',roles:['coordinator'],requiresEvidence:true,dualControl:true}
 ],
 assess:x=>{const urgent=x.urgency==='urgent';const hold=x.consentVerified!==true||x.eligibilityStatus!=='eligible'||x.duplicateStatus!=='clear'||x.restrictionStatus!=='satisfied';const ops=x.volunteerStatus!=='available'||!['delivered','not_required'].includes(x.messageStatus)||x.offlineSyncStatus!=='complete';return{disposition:urgent?'immediate_staff_escalation_required':hold?'eligibility_consent_or_restriction_hold':ops?'staffing_communication_or_offline_recovery':'coordinator_service_review_required',serviceCommand:null,automatedAssignment:false,caseVersion:x.caseVersion};}
};
