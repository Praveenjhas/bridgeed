import type { University } from "@bridgeed/shared/src/types/university";
import { UniversityRepository } from "../repositories/university.repository";

export interface CreateUniversityInput {
  name: string;
  country: string;
  state?: string | null;
  city?: string | null;
  websiteUrl?: string | null;
  verified?: boolean;
}

export class UniversityService {
  constructor(private readonly universityRepository: UniversityRepository) {}

  async createUniversity(input: CreateUniversityInput): Promise<University> {
    const existingUniversity = await this.universityRepository.findByName(
      input.name,
    );

    if (existingUniversity) {
      throw new Error("A university with this name already exists");
    }

    const university: University = {
      id: crypto.randomUUID(),
      name: input.name,
      country: input.country,
      state: input.state ?? null,
      city: input.city ?? null,
      websiteUrl: input.websiteUrl ?? null,
      verified: input.verified ?? false,
      createdAt: new Date().toISOString(),
    };

    return this.universityRepository.create(university);
  }

  async getUniversityById(id: string): Promise<University | null> {
    return this.universityRepository.findById(id);
  }

  async getAllUniversities(): Promise<University[]> {
    return this.universityRepository.findAll();
  }
}
