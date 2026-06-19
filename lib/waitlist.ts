import { isSupabaseServerConfigured, supabaseServer } from './supabase/server';
import { loadMockDB, saveMockDB } from './supabase/mockDb';
import { WaitlistEntry } from './types';

export interface WaitlistInput {
  email: string;
  intent: 'launch' | 'price_alert';
  wishlist_slugs: string[] | null;
  consent_service: boolean;
  consent_marketing: boolean;
}

/**
 * Upserts a waitlist entry to either Supabase or the local mock database.
 * If the email already exists, it updates the consents, intent, wishlist_slugs,
 * and updated_at timestamp.
 */
export async function upsertWaitlist(input: WaitlistInput): Promise<WaitlistEntry> {
  const useSupabase = isSupabaseServerConfigured();

  if (useSupabase) {
    const { data, error } = await supabaseServer
      .from('waitlist')
      .upsert(
        {
          email: input.email,
          intent: input.intent,
          wishlist_slugs: input.wishlist_slugs,
          consent_service: input.consent_service,
          consent_marketing: input.consent_marketing,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'email',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('[Waitlist Helper] Supabase upsert error:', error);
      throw new Error(`DB upsert error: ${error.message}`);
    }

    return data as WaitlistEntry;
  } else {
    // Local DB fallback for testing/dev environments
    const db = loadMockDB();
    if (!db.waitlist) {
      db.waitlist = [];
    }

    const existingIndex = db.waitlist.findIndex(
      (w) => w.email.toLowerCase() === input.email.toLowerCase()
    );
    const now = new Date().toISOString();

    if (existingIndex > -1) {
      // Upsert: update existing entry
      const existing = db.waitlist[existingIndex];
      const updated: WaitlistEntry = {
        ...existing,
        intent: input.intent,
        wishlist_slugs: input.wishlist_slugs,
        consent_service: input.consent_service,
        consent_marketing: input.consent_marketing,
        updated_at: now,
      };
      db.waitlist[existingIndex] = updated;
      saveMockDB(db);
      return updated;
    } else {
      // Insert: create new entry
      const newId =
        db.waitlist.reduce((max, item) => (item.id > max ? item.id : max), 0) + 1;
      const inserted: WaitlistEntry = {
        id: newId,
        email: input.email.toLowerCase(),
        intent: input.intent,
        wishlist_slugs: input.wishlist_slugs,
        consent_service: input.consent_service,
        consent_marketing: input.consent_marketing,
        created_at: now,
        updated_at: now,
      };
      db.waitlist.push(inserted);
      saveMockDB(db);
      return inserted;
    }
  }
}
