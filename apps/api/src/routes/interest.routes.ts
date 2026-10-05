import { Router } from "express";
import { InterestController } from "../controllers/interest.controller";
import { InterestService } from "../services/interest.service";
import { InterestRepository } from "../repositories/interest.repository";

const interestRepository = new InterestRepository();
const interestService = new InterestService(interestRepository);
const interestController = new InterestController(interestService);

export const interestRouter = Router();

interestRouter.post("/", interestController.createInterest);

interestRouter.get("/", interestController.getAllInterests);

interestRouter.get("/:id", interestController.getInterestById);
