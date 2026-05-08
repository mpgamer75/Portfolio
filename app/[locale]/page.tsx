import { setRequestLocale } from 'next-intl/server';
import HomeShell from '@/components/HomeShell';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HomeShell />;
}
