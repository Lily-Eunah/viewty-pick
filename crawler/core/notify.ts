export async function sendDiscordMessage(content: string): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const isConfigured = webhookUrl && webhookUrl.startsWith('https://discord.com/api/webhooks/');

  if (!isConfigured) {
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
}): Promise<boolean> {
  const message = `📊 **[ViewtyPick Crawl Run Summary]**
- **시작/종료 상태**: 완료 (Success)
- **수집 대상 링크**: 총 ${stats.totalLinks}개
- **정상 반영 (OK)**: ${stats.successCount}개
- **경고 대상 (Warning)**: ${stats.warningCount}개
- **실패 제외 (Failed)**: ${stats.failureCount}개
- **소요 시간**: ${stats.durationSeconds.toFixed(1)}초
- 가격 동기화 및 캐시 재생성(ISR)이 트리거되었습니다.`;

  return sendDiscordMessage(message);
}
