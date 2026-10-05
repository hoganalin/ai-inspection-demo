import { useCallback, useState } from 'react';
import type { ActionPlan } from '../types';

const STORAGE_KEY = 'action_plans_v1';

function load(): ActionPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as ActionPlan[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** 已確認的異常處置單，只存在本機（不會真的送出）。 */
export function useActionPlans() {
  const [plans, setPlans] = useState<ActionPlan[]>(load);

  const saveConfirmed = useCallback((plan: ActionPlan) => {
    setPlans(prev => {
      const next = [plan, ...prev.filter(p => p.id !== plan.id)];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setPlans(prev => {
      const next = prev.filter(p => p.id !== id);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);

  return { plans, saveConfirmed, remove };
}
