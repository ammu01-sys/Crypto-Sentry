import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/login');
  }

  const userId = (session.user as any).id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { globalThreshold: true },
  });

  if (!user) {
    redirect('/login');
  }

  return (
    <SettingsClient 
      userId={userId} 
      initialThreshold={user.globalThreshold} 
    />
  );
}

export const dynamic = 'force-dynamic';
