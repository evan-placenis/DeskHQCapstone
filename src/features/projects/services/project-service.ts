import { ProjectRepository } from "./project-repository";
import { Project } from "./project-types";
import { SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from 'uuid';

export class ProjectService {

    private projectRepo: ProjectRepository;

    constructor(projectRepo: ProjectRepository) {
        this.projectRepo = projectRepo;
    }

    async createProject(
        params: { name: string; clientName?: string; address?: string; orgId: string; userId: string },
        client: SupabaseClient
    ): Promise<Project> {
        const { name, clientName, address, orgId, userId } = params;
        const newProjectId = uuidv4();
        const now = new Date();

        const newProject: Project = {
            projectId: newProjectId,
            organizationId: orgId,
            name,
            status: 'ACTIVE',
            metadata: {
                createdAt: now,
                lastModifiedDate: now,
                status: 'ACTIVE',
                createdByUserId: userId,
            },
            jobInfo: {
                clientName: clientName ?? "",
                siteAddress: address ?? "",
                parsedData: {},
            },
            createdAt: now,
            updatedAt: now,
            images: [],
            knowledgeItems: [],
        };

        await this.projectRepo.save(newProject, client);
        return newProject;
    }

    async getById(projectId: string, client: SupabaseClient): Promise<Project | null> {
        return this.projectRepo.getById(projectId, client);
    }

    async getByOrgId(organizationId: string, client: SupabaseClient): Promise<Project[]> {
        return this.projectRepo.getByOrgId(organizationId, client);
    }

    async deleteProject(projectId: string, client: SupabaseClient): Promise<void> {
        return this.projectRepo.delete(projectId, client);
    }
}
