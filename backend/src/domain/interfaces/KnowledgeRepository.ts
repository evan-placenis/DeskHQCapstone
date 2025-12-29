import { KnowledgeItem } from "../knowledge/rag.types";

export interface KnowledgeRepository {
    save(item: KnowledgeItem): Promise<void>;
    getById(kId: string): Promise<KnowledgeItem | null>;
    listByProject(projectId: string): Promise<KnowledgeItem[]>;
    updateStatus(kId: string, status: 'PROCESSING' | 'INDEXED' | 'FAILED'): Promise<void>;
}