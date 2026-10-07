import { Router } from "express";
import { SubjectController } from "../controllers/subject.controller";
import { SubjectService } from "../services/subject.service";
import { SubjectRepository } from "../repositories/subject.repository";

const subjectRepository = new SubjectRepository();

const subjectService = new SubjectService(subjectRepository);

const subjectController = new SubjectController(subjectService);

/** The subject catalog: `GET /subjects?search=&page=&limit=`. */
export const subjectRouter = Router();

subjectRouter.get("/", subjectController.getSubjects);
