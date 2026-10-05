import type { Interest } from "@bridgeed/shared/src/types/interest";
import { InterestRepository } from "../repositories/interest.repository";

export interface CreateInterestInput {
  name: string;
}

export class InterestService {
  constructor(private readonly interestRepository: InterestRepository) {}

  async createInterest(input: CreateInterestInput): Promise<Interest> {
    const name = input.name.trim();

    const existingInterest = await this.interestRepository.findByName(name);

    if (existingInterest) {
      throw new Error("An interest with this name already exists");
    }

    const interest: Interest = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
    };

    return this.interestRepository.create(interest);
  }

  async getInterestById(id: string): Promise<Interest | null> {
    return this.interestRepository.findById(id);
  }

  async getAllInterests(): Promise<Interest[]> {
    return this.interestRepository.findAll();
  }
}
