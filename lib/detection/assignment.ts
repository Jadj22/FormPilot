import type { DetectedField, LearnedMapping, SemanticType } from '../types';
import { NEGATIVE_RULES, isAuthorizedType, normalizeLabel } from './rules';

export interface AssignmentResult {
  key: string;
  type: SemanticType | null;
  confidence: number;
  scoreBreakdown: Partial<Record<SemanticType, number>>;
  warnings: string[];
}

/** Retrouve le mapping appris (name, puis id, puis libellé) pour un champ. */
function findLearnedMapping(
  field: DetectedField,
  hostname: string,
  mappings: LearnedMapping[],
): LearnedMapping | undefined {
  const forHost = mappings.filter(
    (m) => m.hostname === hostname || hostname.endsWith(`.${m.hostname}`),
  );
  const signatures = [
    field.name ? `name:${field.name.toLowerCase().trim()}` : null,
    field.id ? `id:${field.id.toLowerCase().trim()}` : null,
    field.label ? `label:${field.label.toLowerCase().trim()}` : null,
  ];
  for (const sig of signatures) {
    if (!sig) continue;
    const hit = forHost.find((m) => m.fieldSignature === sig);
    if (hit) return hit;
  }
  return undefined;
}

export function assignFieldsPerBlock(
  fields: DetectedField[],
  learnedMappings: LearnedMapping[] = [],
  hostname: string = '',
): AssignmentResult[] {
  return fields.map((field) => {
    const warnings: string[] = [];
    const normalized = normalizeLabel(field.label || '');

    // Un mapping appris l'emporte toujours
    const learned = findLearnedMapping(field, hostname, learnedMappings);
    if (learned) {
      return {
        key: field.key,
        type: learned.type,
        confidence: 100,
        scoreBreakdown: { [learned.type]: 100 },
        warnings,
      };
    }

    let type: SemanticType | null = field.type;
    let confidence = field.confidence;

    for (const rule of NEGATIVE_RULES) {
      if (rule.pattern.test(normalized)) {
        warnings.push(`Exclusion: ${rule.pattern.source}`);
      }
    }

    if (type && !isAuthorizedType(type)) {
      type = null;
      confidence = 0;
    }

    return {
      key: field.key,
      type,
      confidence,
      scoreBreakdown: type ? { [type]: confidence } : {},
      warnings,
    };
  });
}
