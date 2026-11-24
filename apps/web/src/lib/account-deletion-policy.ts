export const DELETE_DIRECT_COLLECTIONS = ["users", "profiles", "resumes", "career_goals", "job_preferences", "salary_research", "document_drafts", "registration_consents", "signup_price_locks", "daily_job_feeds", "job_refresh_requests", "user_settings", "entitlements", "recruiter_accounts", "mentor_applications", "mentors", "contact_match_consents"] as const;

export const DELETE_OWNER_COLLECTIONS = ["profile_versions", "resume_versions", "resume_transform_versions", "analyses", "usage_ledger", "usage_allowances", "rate_limits", "public_profiles", "document_draft_versions", "ai_runs", "ai_cache", "support_tickets", "notifications", "product_events", "recruiter_jobs", "feed_events", "feed_reactions", "mentor_payout_ledger"] as const;

export const RETAIN_OWNER_ANONYMIZED_COLLECTIONS = ["addon_orders", "subscriptions", "consent_events"] as const;

function withoutKey(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const copy = { ...(value as Record<string, unknown>) };
  delete copy[key];
  return copy;
}

function withoutValue(value: unknown, removed: string) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item !== removed) : [];
}

export function anonymizeConversationForDeletedAccount(value: Record<string, unknown>, uid: string, deletedMarker: string) {
  const participantIds = withoutValue(value.participantIds, uid).concat(deletedMarker);
  const lastMessageWasAuthoredByDeletedAccount = value.lastMessageSenderId === uid;
  return {
    participantIds,
    initiatedBy: value.initiatedBy === uid ? deletedMarker : value.initiatedBy ?? null,
    recipientPublicProfileId: null,
    lastMessageSenderId: lastMessageWasAuthoredByDeletedAccount ? deletedMarker : value.lastMessageSenderId ?? null,
    lastMessagePreview: lastMessageWasAuthoredByDeletedAccount ? "Message removed after account deletion." : value.lastMessagePreview ?? "",
    readMessageIds: withoutKey(value.readMessageIds, uid),
    readAtByParticipant: withoutKey(value.readAtByParticipant, uid),
    blockedBy: withoutValue(value.blockedBy, uid),
  };
}
