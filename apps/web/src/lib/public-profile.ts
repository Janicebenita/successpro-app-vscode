import type { CanonicalProfile } from "@successpro/contracts";

const defaultVisibility: CanonicalProfile["publicProfileVisibility"] = { summary: true, location: true, currentRole: true, industry: true, skills: true, experience: true, education: true, photo: false };

export function publicProfileProjection(profile: CanonicalProfile) {
  const visibility = { ...defaultVisibility, ...profile.publicProfileVisibility };
  return {
    fullName: profile.fullName,
    headline: profile.headline,
    location: visibility.location ? profile.location : "",
    summary: visibility.summary ? profile.summary : "",
    currentRole: visibility.currentRole ? profile.currentRole : "",
    industry: visibility.industry ? profile.industry : "",
    skills: visibility.skills ? profile.skills : [],
    experience: visibility.experience ? profile.experience : [],
    education: visibility.education ? profile.education : [],
    openToWork: profile.openToWork,
    photoPublic: visibility.photo && Boolean(profile.profilePhotoUpdatedAt),
    searchEngineIndexable: profile.searchEngineIndexable,
    publicProfileVisibility: visibility,
  };
}
