export interface ExtensionSettings {
  /** GitHub repo name for learning notes. Default: "dev-learning-log" */
  repoName: string;
  /**
   * Commit message format. Tokens: {action}, {roadmap}, {topic}, {date}
   * Default: "{action}({roadmap}): {topic}"
   */
  commitMessageFormat: string;
  /** Whether to enable AI enhancement. Default: true */
  aiEnabled: boolean;
  /** Panel slide-in position. Default: "right" */
  panelPosition: 'left' | 'right';
  /**
   * Custom markdown template for notes.
   * Tokens: {topic}, {roadmap}, {date}, {description}, {resources}, {notes}
   * Empty string means use the built-in template.
   */
  noteTemplate: string;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  repoName: 'dev-learning-log',
  commitMessageFormat: '{action}({roadmap}): {topic}',
  aiEnabled: true,
  panelPosition: 'right',
  noteTemplate: '',
};

const SETTINGS_KEY = 'roadmaphub_settings';

export async function getSettings(): Promise<ExtensionSettings> {
  const r = await chrome.storage.local.get([SETTINGS_KEY]);
  return { ...DEFAULT_SETTINGS, ...(r[SETTINGS_KEY] || {}) };
}

export async function saveSettings(patch: Partial<ExtensionSettings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({ [SETTINGS_KEY]: { ...current, ...patch } });
}

/**
 * Format a commit message using the configured format string.
 * action: 'learn' for first commit, 'update' for re-commits.
 */
export function formatCommitMessage(
  format: string,
  action: 'learn' | 'update',
  roadmapSlug: string,
  topicName: string
): string {
  return format
    .replace('{action}', action)
    .replace('{roadmap}', roadmapSlug)
    .replace('{topic}', topicName)
    .replace('{date}', new Date().toISOString().split('T')[0]);
}
