import { createClient } from '@metagptx/web-sdk';

export const client = createClient();
export const FLYER_BUCKET = 'event-flyers';

export interface AdminUser {
  id: number;
  email: string;
  role: 'admin' | 'super_admin';
  created_at: string;
}
