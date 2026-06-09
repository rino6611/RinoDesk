import { format, formatDistanceToNow } from 'date-fns';

export function formatDate(dateStr: string | null | undefined, pattern: string = 'PPp') {
  if (!dateStr) return '';
  try {
    return format(new Date(dateStr), pattern);
  } catch (e) {
    return '';
  }
}

export function formatTimeAgo(dateStr: string | null | undefined) {
  if (!dateStr) return '';
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch (e) {
    return '';
  }
}
