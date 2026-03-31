import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';

export interface SkillDocument {
  name: string;
  description: string;
  body: string;
}

const skillCache = new Map<string, SkillDocument>();

const SKILLS_DIR = path.resolve(process.cwd(), 'skills');

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

function resolveSkillPath(skillName: string): string {
  return path.join(SKILLS_DIR, `${skillName}.md`);
}

export function loadSkill(skillName: string): SkillDocument {
  if (skillCache.has(skillName)) {
    return skillCache.get(skillName)!;
  }

  const filePath = resolveSkillPath(skillName);

  if (!fs.existsSync(filePath)) {
    logger.error(`[skill-loader] Skill file not found at: ${filePath}`);
    return {
      name: skillName,
      description: `Skill "${skillName}" could not be loaded.`,
      body: '',
    };
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = parseFrontmatter(raw);
  skillCache.set(skillName, parsed);
  return parsed;
}

export function buildSkillPrompt(skillNames: string[]): string {
  const docs = skillNames.map(loadSkill);
  return docs.map((doc) => `# Skill: ${doc.name}\n${doc.description}\n\n${doc.body}`).join('\n\n');
}
