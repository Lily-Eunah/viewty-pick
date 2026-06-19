import { NextRequest, NextResponse } from 'next/server';
import { upsertWaitlist } from '../../../lib/waitlist';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, intent, wishlist_slugs, consent_service, consent_marketing } = body;

    // 1. Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: '이메일 주소를 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: '올바른 이메일 형식이 아닙니다.' },
        { status: 400 }
      );
    }

    // 2. Validate intent
    if (intent !== 'launch' && intent !== 'price_alert') {
      return NextResponse.json(
        { error: '올바르지 않은 신청 목적입니다.' },
        { status: 400 }
      );
    }

    // 3. Validate service consent
    if (consent_service !== true) {
      return NextResponse.json(
        { error: '서비스 출시 및 기능 알림 수신 동의(필수)가 필요합니다.' },
        { status: 400 }
      );
    }

    // 4. Validate wishlist_slugs type if provided
    if (wishlist_slugs !== undefined && wishlist_slugs !== null) {
      if (!Array.isArray(wishlist_slugs) || !wishlist_slugs.every(s => typeof s === 'string')) {
        return NextResponse.json(
          { error: '올바르지 않은 상품 목록 형식입니다.' },
          { status: 400 }
        );
      }
    }

    // 5. Upsert to DB (with service_role bypass or mock DB fallback)
    const result = await upsertWaitlist({
      email,
      intent,
      wishlist_slugs: wishlist_slugs || null,
      consent_service: true,
      consent_marketing: !!consent_marketing,
    });

    return NextResponse.json({
      success: true,
      message: intent === 'launch'
        ? '신청 완료 — 출시되면 알려드릴게요.'
        : '신청 완료 — 가격 할인 알림이 신청되었습니다.',
      data: {
        email: result.email,
        intent: result.intent,
        updated_at: result.updated_at,
      },
    });
  } catch (error) {
    console.error('[Waitlist API] POST error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    );
  }
}
