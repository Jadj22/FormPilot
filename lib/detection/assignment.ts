import type { DetectedField, LearnedMapping } from '../types';
import { applyLearnedMappings } from './classify';
import { isAuthorizedType, normalizeLabel } from './rules';

export interface AssignmentResult {
  key: string;
  type: SemanticType | null;
  confidence: number;
  scoreBreakdown: Record<SemanticType, number>;
  warnings: string[];
}

export function assignFieldsPerBlock(
  fields: DetectedField[],
  learnedMappings: LearnedMapping[] = [],
  hostname: string = ''
): AssignmentResult[] {
  // Appliquer d'abord les learned mappings
  const withLearned = applyLearnedMappings(fields, hostname);

  // Calculer la confiance pour chaque champ
  return withLearned.map((field) => {
    const label = field.label || '';
    const normalized = normalizeLabel(label);
    let type: SemanticType | null = field.type;
    let confidence = field.confidence;
    const warnings: string[] = [];

    // Vérifier les règles négatives
    for (const rule of NEGATIVE_RULES) {
      if (rule.pattern.test(normalized)) {
        warnings.push(`Exclusion: ${rule.pattern.source}`);
        if (!type) {
          // Ne pas attribuer de type si règle négative forte
          type = null;
          confidence = 0;
        }
      }
    }

    // S'assurer que le type est autorisé
    if (type && !isAuthorizedType(type)) {
      type = null;
      confidence = 0;
    }

    return {
      key: field.key,
      type,
      confidence,
      scoreBreakdown: {},
      warnings,
    };
  });
}