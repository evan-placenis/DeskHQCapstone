export interface HeliconeContextInput {
    userId: string;
    organizationId?: string;
    projectId?: string;
    reportId?: string;
    sessionId?: string;
    templateId?: string;
    feature: string;
    requestId?: string;
}

export interface HeliconeContext {
    baseURL: string;
    headers: Record<string, string>;
}

const DEFAULT_HELICONE_BASE_URL = 'https://gateway.helicone.ai';
const OPAQUE_ID_REGEX = /^[a-zA-Z0-9._:-]+$/;

/**
 * Helicone target URLs per LLM provider.
 * The gateway routes to the real provider using the Helicone-Target-Url header.
 */
export const HELICONE_TARGET_URLS: Record<string, string> = {
    openai: 'https://api.openai.com',
    xai: 'https://api.x.ai',
    google: 'https://generativelanguage.googleapis.com',
    anthropic: 'https://api.anthropic.com',
    nvidia: 'https://integrate.api.nvidia.com/',
};

export const HELICONE_TARGET_URL_HEADER = 'Helicone-Target-URL';

export class HeliconeContextBuilder {
    static build(input: HeliconeContextInput): HeliconeContext {
        const apiKey = process.env.HELICONE_API_KEY;
        if (!apiKey) {
            throw new Error('HELICONE_API_KEY is required for Helicone routing.');
        }

        const baseURL = process.env.HELICONE_BASE_URL || DEFAULT_HELICONE_BASE_URL;
        const headers: Record<string, string> = {
            'Helicone-Auth': `Bearer ${apiKey}`,
            'Helicone-User-Id': sanitizeOpaqueId(input.userId, 'userId'),
            'Helicone-Property-Feature': sanitizeFeature(input.feature),
        };

        addOptionalHeader(headers, 'Helicone-Property-OrganizationId', input.organizationId);
        addOptionalHeader(headers, 'Helicone-Property-ProjectId', input.projectId);
        addOptionalHeader(headers, 'Helicone-Property-ReportId', input.reportId);
        addOptionalHeader(headers, 'Helicone-Property-SessionId', input.sessionId);
        addOptionalHeader(headers, 'Helicone-Property-TemplateId', input.templateId);
        addOptionalHeader(headers, 'Helicone-Property-RequestId', input.requestId);

        return { baseURL, headers };
    }

    /**
     * Serialize only the *input* for Trigger.dev payloads.
     * The API key is never included — the worker calls .build() locally.
     */
    static serializeForTrigger(input: HeliconeContextInput): string {
        return JSON.stringify(input);
    }

    static deserializeForTrigger(serialized: string): HeliconeContextInput {
        const parsed = JSON.parse(serialized) as Partial<HeliconeContextInput>;
        if (!parsed.userId || !parsed.feature) {
            throw new Error('Invalid serialized Helicone input: userId and feature are required.');
        }
        return parsed as HeliconeContextInput;
    }
}

function addOptionalHeader(
    headers: Record<string, string>,
    headerName: string,
    value?: string,
): void {
    if (!value) return;
    headers[headerName] = sanitizeOpaqueId(value, headerName);
}

function sanitizeOpaqueId(value: string, label: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error(`Missing required Helicone value for "${label}".`);
    }
    if (!OPAQUE_ID_REGEX.test(trimmed)) {
        throw new Error(
            `Invalid Helicone value for "${label}". Only opaque IDs (alphanumeric, dots, colons, hyphens, underscores) are allowed — no PII.`,
        );
    }
    return trimmed;
}

function sanitizeFeature(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error('Missing required Helicone feature value.');
    }
    return trimmed.replace(/\s+/g, '_');
}
