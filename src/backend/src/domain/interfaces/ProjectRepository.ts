import { Project } from "../core/project.types";
import { SupabaseClient } from "@supabase/supabase-js";

export interface ProjectRepository {
    getById(projectId: string, client: SupabaseClient): Promise<Project | null>;
    getByOrgId(organizationId: string, client: SupabaseClient): Promise<Project[]>;
    save(project: Project, client: SupabaseClient): Promise<void>;
}