export const CATEGORIES = [
  'Royalty & Payments',
  'ISBN & Metadata Issues',
  'Printing & Quality',
  'Distribution & Availability',
  'Book Status & Production Updates',
  'General Inquiry',
] as const;
export const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
export const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'] as const;

export type Category = (typeof CATEGORIES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Status = (typeof STATUSES)[number];
export type Role = 'author' | 'admin';
