export interface SpecImageRecord {
    id: string;        // We generate this UUID in code so we can stitch it
    project_id: string;
    /** Links this image to the knowledge document it was extracted from (for cascade delete) */
    k_id?: string;
    url: string;
    storage_path: string;
    description: string;
  }