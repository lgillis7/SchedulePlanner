'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

interface PasscodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PasscodeModal({ open, onOpenChange }: PasscodeModalProps) {
  const { unlock } = useAuth();
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) return;

    setLoading(true);
    try {
      const result = await unlock(passcode);
      if (result.success) {
        setPasscode('');
        onOpenChange(false);
      } else {
        toast.error(result.error ?? 'Invalid passcode');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Unlock Editing</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 pt-2">
          <Input
            type="password"
            placeholder="Enter passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            autoFocus
          />
          <Button type="submit" disabled={loading || !passcode.trim()}>
            {loading ? 'Verifying...' : 'Unlock'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
