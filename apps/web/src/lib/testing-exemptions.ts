export function normalizedEmailSet(value = process.env.SUCCESSPRO_RESUME_REVIEW_EXEMPT_EMAILS ?? "") {
  return new Set(value.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

export function hasResumeReviewTestExemption(user: { email?: string; email_verified?: boolean }) {
  const email = user.email?.trim().toLowerCase();
  return Boolean(email && user.email_verified === true && normalizedEmailSet().has(email));
}
