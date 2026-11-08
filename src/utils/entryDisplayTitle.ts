export interface EntryTitleFields {
  description?: string | null;
  category: string;
}

export const entryDisplayTitle = (entry: EntryTitleFields): string =>
  entry.description?.trim() || entry.category;
