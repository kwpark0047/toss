const parseOptionGroups = (options) => {
  try {
    const parsed = typeof options === 'string' ? JSON.parse(options || '[]') : options;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export function normalizeMenuOptionGroups(options) {
  return parseOptionGroups(options).map((group, groupIndex) => {
    const sourceChoices = Array.isArray(group?.choices)
      ? group.choices
      : Array.isArray(group?.items)
        ? group.items
        : (Array.isArray(group?.values) ? group.values : []).map((name, choiceIndex) => ({
            name,
            price_adjustment: group?.prices?.[choiceIndex] || 0,
          }));
    const type =
      group?.type === 'checkbox' || Number(group?.max_choices ?? group?.maxSelect) > 1
        ? 'checkbox'
        : 'radio';
    const isRequired = Boolean(group?.is_required ?? group?.required);

    return {
      ...group,
      id: String(group?.id ?? `group-${groupIndex + 1}`),
      name: String(group?.name || ''),
      type,
      is_required: isRequired,
      min_choices: isRequired
        ? Math.max(1, Number(group?.min_choices ?? group?.minSelect) || 0)
        : Math.max(0, Number(group?.min_choices ?? group?.minSelect) || 0),
      max_choices: Math.max(
        1,
        Number(group?.max_choices ?? group?.maxSelect) ||
          (type === 'radio' ? 1 : sourceChoices.length || 1)
      ),
      choices: sourceChoices.map((choice, choiceIndex) =>
        typeof choice === 'string'
          ? {
              id: `choice-${groupIndex + 1}-${choiceIndex + 1}`,
              name: choice,
              price_adjustment: 0,
              is_active: true,
            }
          : {
              ...choice,
              id: String(choice?.id ?? `choice-${groupIndex + 1}-${choiceIndex + 1}`),
              name: String(choice?.name || ''),
              price_adjustment: Number(choice?.price_adjustment ?? choice?.price ?? 0) || 0,
              is_active: choice?.is_active !== false && choice?.isActive !== false,
            }
      ),
    };
  });
}
