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

/**
 * Sends the daily pipeline run summary.
 */
export async function sendDailySummary(stats: {
  totalLinks: number;
  successCount: number;
  warningCount: number;
  failureCount: number;
  durationSeconds: number;
  // OK_NO_OFFER coverage info — NOT failures. A legitimate "no qualified offer"
  // (link-only listing) does not increment fail_count; reported here as info.
  noOfferCount?: number;
  // Listings that had a real price last run and now have no offer (price dropped
  // to link-only). Operator-facing info line, not a per-item alert.
  disappearedOffers?: string[];
}): Promise<boolean> {
  const noOffer = stats.noOfferCount ?? 0;
  const disappeared = stats.disappearedOffers ?? [];

  let message = `📊 **[ViewtyPick Crawl Run Summary]**
- **시작/종료 상태**: 완료 (Success)
- **수집 대상 링크**: 총 ${stats.totalLinks}개
- **정상 반영 (OK)**: ${stats.successCount}개
- **경고 대상 (Warning)**: ${stats.warningCount}개
- **실패 제외 (Failed)**: ${stats.failureCount}개
- **오퍼 없음 (No offer · 정보)**: ${noOffer}개 — 정상(link-only), fail_count 미반영
- **소요 시간**: ${stats.durationSeconds.toFixed(1)}초
- 가격 동기화 및 캐시 재생성(ISR)이 트리거되었습니다.`;

  if (disappeared.length > 0) {
    const shown = disappeared.slice(0, 10);
    const more = disappeared.length > shown.length ? ` 외 ${disappeared.length - shown.length}건` : '';
    message += `\nℹ️ **오퍼 사라짐 (가격→link-only, 확인 권장)**: ${disappeared.length}건${more}\n${shown.map((d) => `  • ${d}`).join('\n')}`;
  }

  return sendDiscordMessage(message);
}
