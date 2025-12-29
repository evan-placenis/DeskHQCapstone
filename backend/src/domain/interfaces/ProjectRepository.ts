import { Project } from "../core/project.types";

export interface ProjectRepository {
    getById(projectId: string): Promise<Project | null>;
    save(project: Project): Promise<void>;
}