export const formatEntryDate = (date: string, now = new Date()): string => {
  const [year, month, day] = date.split('-').map(Number);
  const entry = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (entry.getTime() === today.getTime()) return 'Today';
  if (entry.getTime() === yesterday.getTime()) return 'Yesterday';
  return entry.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
};
