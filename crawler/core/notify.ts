export async function sendDiscordMessage(content: string): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const isMock =
    process.env.VIEWTYPICK_MOCK_MODE === 'true' ||
    process.env.CRAWLER_MODE === 'mock' ||
    !webhookUrl ||
    webhookUrl.includes('placeholder') ||
    webhookUrl.includes('example') ||
    webhookUrl.includes('dummy') ||
    webhookUrl.trim() === '' ||
    !webhookUrl.startsWith('https://discord.com/api/webhooks/');

  if (isMock) {
    console.log(`[Discord Notification (Mock)]:\n${content}\n`);
    return true;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });

    return response.ok;
  } catch (e) {
    console.error('[Discord Alerting] Failed to send webhook message:', e);
    return false;
  }
}

/**
 * Sends a structured critical alarm message.
 */
export async function sendCriticalAlarm(subject: string, details: string): Promise<boolean> {
  const message = `🚨 **[ViewtyPick CRITICAL]** ${subject}\n\`\`\`\n${details}\n\`\`\``;
  return sendDiscordMessage(message);
}

export interface DailySummaryStats {
  totalLinks: number;
  successCount: number;
  warningCount: number;
  failureCount: number;
  durationSeconds: number;
  // OK_NO_OFFER coverage info — NOT failures. A legitimate "no qualified offer"
  // (link-only listing) does not increment fail_count; reported here as info.
  noOfferCount?: number;
  // Link-only sellers with no registered price adapter (zigzag/ably). They are
  // intentionally not crawled (is_price_comparison_enabled=false) — NOT failures.
  // Reported as info and excluded from the success-rate denominator.
  skippedNoAdapterCount?: number;
  // Listings that had a real price last run and now have no offer (price dropped
  // to link-only). Operator-facing info line, not a per-item alert.
  disappearedOffers?: string[];
  // Listing-level data problems that blocked a fetch (e.g. a Coupang share
  // short-link with no productId). Not failures — the operator must fix the
  // sheet URL. Surfaced here for action.
  dataErrors?: string[];
  // Held (warning) prices awaiting an O/X decision in the inspection tab.
  pendingInspectionCount?: number;
  inspectionItems?: string[];
  // Crawl-target links that produced NO price this run (no_offer / data_error /
  // 이종세트 보류) and are listed in the link_only tab for operator action. Distinct
  // from inspection (those DO have a held price); reported separately.
  linkOnlyUnmatchedCount?: number;
  // Priced offers whose title carries a BARE "N종" (e.g. "쿠션 2종") — usually an
  // "N종 중 택1" option-select page (priced as a single), but possibly a real set.
  // Informational only (price IS shown); operator confirms set-vs-option from this list.
  nJongVerifyItems?: string[];
}

/**
 * Builds the daily run summary message. Pure (stats in, string out) so the
 * Failed/Skipped accounting can be unit-tested without a Discord webhook.
 */
export function buildDailySummaryMessage(stats: DailySummaryStats): string {
  const noOffer = stats.noOfferCount ?? 0;
  const skippedNoAdapter = stats.skippedNoAdapterCount ?? 0;
  const disappeared = stats.disappearedOffers ?? [];
  const dataErrors = stats.dataErrors ?? [];
  const pendingInspection = stats.pendingInspectionCount ?? 0;
  const inspectionItems = stats.inspectionItems ?? [];
  const linkOnlyUnmatched = stats.linkOnlyUnmatchedCount ?? 0;
  const nJongVerify = stats.nJongVerifyItems ?? [];

  let message = `📊 **[ViewtyPick Crawl Run Summary]**
- **시작/종료 상태**: 완료 (Success)
- **수집 대상 링크**: 총 ${stats.totalLinks}개
- **정상 반영 (OK)**: ${stats.successCount}개
- **경고 대상 (Warning)**: ${stats.warningCount}개
- **실패 제외 (Failed)**: ${stats.failureCount}개
- **오퍼 없음 (No offer · 정보)**: ${noOffer}개 — 정상(link-only), fail_count 미반영
- **수집 제외 (Skipped · link-only, 어댑터 없음)**: ${skippedNoAdapter}개 — zigzag/ably 등, 실패 아님
- **소요 시간**: ${stats.durationSeconds.toFixed(1)}초
- 가격 동기화 및 캐시 재생성(ISR)이 트리거되었습니다.`;

  if (disappeared.length > 0) {
    const shown = disappeared.slice(0, 10);
    const more = disappeared.length > shown.length ? ` 외 ${disappeared.length - shown.length}건` : '';
    message += `\nℹ️ **오퍼 사라짐 (가격→link-only, 확인 권장)**: ${disappeared.length}건${more}\n${shown.map((d) => `  • ${d}`).join('\n')}`;
  }

  if (dataErrors.length > 0) {
    const shown = dataErrors.slice(0, 10);
    const more = dataErrors.length > shown.length ? ` 외 ${dataErrors.length - shown.length}건` : '';
    message += `\n⚠️ **데이터 오류 (시트 URL 수정 필요, fail_count 미반영)**: ${dataErrors.length}건${more}\n${shown.map((d) => `  • ${d}`).join('\n')}`;
  }

  if (pendingInspection > 0) {
    const shown = inspectionItems.slice(0, 10);
    const more = inspectionItems.length > shown.length ? ` 외 ${inspectionItems.length - shown.length}건` : '';
    message += `\n📝 **검수 대기 (inspection 탭에서 O 노출 / X 거부)**: ${pendingInspection}건${more}\n${shown.map((d) => `  • ${d}`).join('\n')}`;
  }

  if (linkOnlyUnmatched > 0) {
    message += `\n🔗 **가격 미매칭 link-only (link_only 탭에서 원인·액션 확인)**: ${linkOnlyUnmatched}건 — 가격 자체가 없는 링크(쿠팡 URL 교체·네이버/올영 확인)`;
  }

  if (nJongVerify.length > 0) {
    const shown = nJongVerify.slice(0, 10);
    const more = nJongVerify.length > shown.length ? ` 외 ${nJongVerify.length - shown.length}건` : '';
    message += `\n🔎 **N종 옵션 링크 — 세트 여부 확인 (정보, 가격 노출 유지)**: ${nJongVerify.length}건${more} — 대개 'N종 중 택1' 옵션선택(단품), 진짜 세트면 조치\n${shown.map((d) => `  • ${d}`).join('\n')}`;
  }

  return message;
}

/**
 * Sends the daily pipeline run summary.
 */
export async function sendDailySummary(stats: DailySummaryStats): Promise<boolean> {
  return sendDiscordMessage(buildDailySummaryMessage(stats));
}
