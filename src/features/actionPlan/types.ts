export const NOTIFY_UNITS = ['生產', '製程', '設備', 'QA'] as const;
export type NotifyUnit = (typeof NOTIFY_UNITS)[number];

/** 處置單中由人審閱、可編輯的文字段落。 */
export interface ActionPlanSections {
  description: string;
  causes: string;
  checks: string;
  containment: string;
}

/** 異常處置單：預警或異常觸發，由 AI 草擬、經人確認。 */
export interface ActionPlan {
  id: string;
  lotId: string;
  signal: 'outOfControl' | 'warningSignal';
  rulesFired: string[];
  sections: ActionPlanSections;
  notifyUnits: NotifyUnit[];
  followUpDate: string;
  status: 'draft' | 'confirmed';
  createdAt: string;
  confirmedAt?: string;
  confirmedBy?: string;
}
