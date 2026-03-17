import fs from 'fs';
import path from 'path';

export interface SkillDocument {
  name: string;
  description: string;
  body: string;
}

const skillCache = new Map<string, SkillDocument>();

const SKILLS_DIR = path.resolve(
  process.cwd(),
  'src', 'backend', 'src', 'AI_Skills', 'chatbot-skills', 'agent-skills',
);

function parseFrontmatter(markdown: string): SkillDocument {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return {
      name: 'unnamed-skill',
      description: 'No description provided.',
      body: markdown.trim(),
    };
  }

  const frontmatter = match[1];
  const body = match[2].trim();
  const meta: Record<string, string> = {};

  for (const line of frontmatter.split(/\r?\n/)) {
    const [rawKey, ...rest] = line.split(':');
    if (!rawKey || rest.length === 0) continue;
    meta[rawKey.trim()] = rest.join(':').trim().replace(/^['"]|['"]$/g, '');
  }

  return {
    name: meta.name || 'unnamed-skill',
    description: meta.description || 'No description provided.',
    body,
  };
}

function resolveSkillPath(skillFolder: string): string {
  return path.join(SKILLS_DIR, skillFolder, 'SKILL.md');
}

export function loadSkill(skillFolder: string): SkillDocument {
  if (skillCache.has(skillFolder)) {
    return skillCache.get(skillFolder)!;
  }

  const filePath = resolveSkillPath(skillFolder);

  if (!fs.existsSync(filePath)) {
    console.error(`[skill-loader] SKILL.md not found at: ${filePath}`);
    return {
      name: skillFolder,
      description: `Skill "${skillFolder}" could not be loaded.`,
      body: '',
    };
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = parseFrontmatter(raw);
  skillCache.set(skillFolder, parsed);
  return parsed;
}

export function buildSkillPrompt(skillFolders: string[]): string {
  const docs = skillFolders.map(loadSkill);
  return docs.map((doc) => `# Skill: ${doc.name}\n${doc.description}\n\n${doc.body}`).join('\n\n');
}
