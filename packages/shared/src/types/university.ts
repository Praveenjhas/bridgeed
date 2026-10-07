export interface University {
  id: string;
  name: string;
  /** Stable URL-safe identifier, used for canonical links and lookups. */
  slug: string;
  country: string;
  state: string | null;
  city: string | null;
  websiteUrl: string | null;
  /** A short editorial summary, or null when none has been written. */
  description: string | null;
  /** Optional logo or profile image URL. */
  logoUrl: string | null;
  verified: boolean;
  createdAt: string;
}
