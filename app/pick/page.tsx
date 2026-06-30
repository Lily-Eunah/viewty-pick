import { redirect } from 'next/navigation';

// Legacy curation hub — consolidated into the data-driven /best SEO landing pages.
// Kept as a redirect so any old link / bookmark lands on the new hub.
export default function PickHubRedirect() {
  redirect('/best');
}
