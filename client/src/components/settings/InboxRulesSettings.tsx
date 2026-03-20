import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// responsive-tuned: mobile-first touch sizing
import { useState } from 'react';
import { api } from '../../lib/api';

interface InboxRuleCondition {
  field: string;
  operator: string;
  value: string;
}

interface InboxRuleAction {
  type: string;
  value: string;
}

interface InboxRule {
  id: string;
  name: string;
  conditions: InboxRuleCondition[];
  actions: InboxRuleAction[];
  isActive: boolean;
  sortOrder: number;
}

export function InboxRulesSettings() {
  const qc = useQueryClient();
  const { data } = useQuery<{ rules: InboxRule[] }>({
    queryKey: ['inbox-rules'],
    queryFn: async () => {
      const result = await api.inboxRules.list();
      return { rules: result.rules as unknown as InboxRule[] };
    },
  });
  const createRule = useMutation({
    mutationFn: (payload: {
      name: string;
      conditions: InboxRuleCondition[];
      actions: InboxRuleAction[];
      isActive: boolean;
      sortOrder: number;
    }) => api.inboxRules.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox-rules'] }),
  });
  const removeRule = useMutation({
    mutationFn: (id: string) => api.inboxRules.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox-rules'] }),
  });
  const [name, setName] = useState('Új szabály');
  const [fromContains, setFromContains] = useState('');
  const [subjectContains, setSubjectContains] = useState('');
  const [label, setLabel] = useState('');

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2">
        <input
          className="dark:bg-dark-bg w-full rounded border px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Szabály neve"
        />
        <input
          className="dark:bg-dark-bg w-full rounded border px-3 py-2"
          value={fromContains}
          onChange={(e) => setFromContains(e.target.value)}
          placeholder="Feladó tartalmazza"
        />
        <input
          className="dark:bg-dark-bg w-full rounded border px-3 py-2"
          value={subjectContains}
          onChange={(e) => setSubjectContains(e.target.value)}
          placeholder="Tárgy tartalmazza"
        />
        <input
          className="dark:bg-dark-bg w-full rounded border px-3 py-2"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="THEN label"
        />
      </div>
      <button
        onClick={() =>
          createRule.mutate({
            name,
            conditions: [
              { field: 'from', operator: 'contains', value: fromContains },
              { field: 'subject', operator: 'contains', value: subjectContains },
            ].filter((c) => c.value.trim().length > 0),
            actions: [
              { type: 'addLabel', value: label },
              { type: 'archive', value: 'true' },
            ].filter((a) => a.value.trim().length > 0),
            isActive: true,
            sortOrder: 0,
          })
        }
        className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
      >
        Szabály hozzáadása
      </button>

      <div className="space-y-2">
        {(data?.rules || []).map((rule) => (
          <div
            key={rule.id}
            className="dark:border-dark-border flex items-center justify-between rounded border border-gray-200 p-2"
          >
            <div>
              <p className="text-sm font-medium">{rule.name}</p>
              <p className="dark:text-dark-text-muted text-xs text-gray-500">
                IF{' '}
                {rule.conditions.map((c) => `${c.field} ${c.operator} "${c.value}"`).join(' AND ')}{' '}
                THEN {rule.actions.map((a) => `${a.type}:${a.value}`).join(', ')}
              </p>
            </div>
            <button
              onClick={() => removeRule.mutate(rule.id)}
              className="text-sm text-red-600 dark:text-red-400"
            >
              Törlés
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
