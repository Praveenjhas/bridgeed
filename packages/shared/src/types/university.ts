export interface University {
  id: string;
  name: string;
  country: string;
  state: string | null;
  city: string | null;
  websiteUrl: string | null;
  verified: boolean;
  createdAt: string;
}
