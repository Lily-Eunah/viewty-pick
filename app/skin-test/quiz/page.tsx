import React from 'react';
import type { Metadata } from 'next';
import AppShell from '../../../components/layout/AppShell';
import Header from '../../../components/layout/Header';
import QuizClient from '../../../components/skin-test/QuizClient';

export const metadata: Metadata = {
  title: '피부 아이스크림 테스트 진행 중 | 뷰티픽',
  robots: { index: false, follow: true },
};

export default function SkinTestQuizPage() {
  return (
    <AppShell showTabBar={false}>
      <Header showBack title="피부 아이스크림 테스트" />
      <QuizClient />
    </AppShell>
  );
}
