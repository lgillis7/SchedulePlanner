'use client';

import { useState } from 'react';
import { Lock, LockOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { PasscodeModal } from './PasscodeModal';

export function EditToggle() {
  const { isEditor, isLoading, lock } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);

  if (isLoading) return null;

  if (isEditor) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={lock}
        title="Lock editing"
        className="gap-1.5"
      >
        <LockOpen className="size-4" />
        Lock
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setModalOpen(true)}
        title="Unlock editing"
        className="gap-1.5"
      >
        <Lock className="size-4" />
        Unlock
      </Button>
      <PasscodeModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
