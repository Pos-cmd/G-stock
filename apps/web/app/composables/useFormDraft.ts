// Saisie en cours transmise de la grande fenêtre à la page, quand on l'ouvre en pleine page.
const drafts = new Map<string, string>();

export type FormDraftKey = "purchase" | "sale" | "simulation";

/** Garde une copie de la saisie ; la page la reprend une seule fois, à son ouverture. */
export const stashFormDraft = (key: FormDraftKey, state: object) => {
  drafts.set(key, JSON.stringify(state));
};

export const takeFormDraft = <T>(key: FormDraftKey): T | undefined => {
  const draft = drafts.get(key);
  drafts.delete(key);
  return draft === undefined ? undefined : (JSON.parse(draft) as T);
};
