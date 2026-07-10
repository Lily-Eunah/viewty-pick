// IndexNow ownership key file, served at /indexnow.txt.
//
// IndexNow (Bing·Naver·Yandex·Seznam) verifies that the submitter owns the host
// by fetching a key file that contains the key. We reference this path via the
// `keyLocation` field in the submit payload, so the file name doesn't have to be
// `{key}.txt`. The key itself is public by design (it only proves host ownership),
// but we read it from the env so it isn't committed and can be rotated.
export const dynamic = 'force-dynamic';

export async function GET() {
  const key = process.env.INDEXNOW_KEY?.trim();
  if (!key) return new Response('Not found', { status: 404 });
  return new Response(key, {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400' },
  });
}
