import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ badge: string; category: string }>;
}

// Legacy badge×category curation pages — superseded by the data-driven /best SEO
// landing pages. Redirect known combos to their /best equivalent, otherwise to the
// /best hub so no old link dead-ends.
const BEST_SLUG: Record<string, string> = {
  'directorpi/sunscreen': 'directorpi-sunscreen',
  'directorpi/skincare': 'skincare-best',
  'directorpi/cleansing-care': 'cleansing-best',
};

export default async function LegacyPickRedirect({ params }: PageProps) {
  const { badge, category } = await params;
  const slug = BEST_SLUG[`${badge}/${category}`];
  redirect(slug ? `/best/${slug}` : '/best');
}
