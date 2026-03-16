'use client';

import { useState } from 'react';
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { Owner, RawTask } from '@/types/scheduling';

interface OwnerManagerProps {
  owners: Owner[];
  tasks: RawTask[];
  projectId: string;
  onCreate: (owner: {
    projectId: string;
    name: string;
    color: string;
    contactInfo?: string;
  }) => Promise<void>;
  onUpdate: (
    ownerId: string,
    updates: Partial<{ name: string; color: string; contactInfo: string | null }>
  ) => Promise<void>;
  onDelete: (ownerId: string) => Promise<void>;
}

interface EditingOwner {
  id: string;
  name: string;
  color: string;
  contactInfo: string;
}

export function OwnerManager({
  owners,
  tasks,
  projectId,
  onCreate,
  onUpdate,
  onDelete,
}: OwnerManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3B82F6');
  const [newContact, setNewContact] = useState('');
  const [editing, setEditing] = useState<EditingOwner | null>(null);

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast.error('Owner name is required');
      return;
    }
    try {
      await onCreate({
        projectId,
        name: newName.trim(),
        color: newColor,
        contactInfo: newContact.trim() || undefined,
      });
      setNewName('');
      setNewColor('#3B82F6');
      setNewContact('');
      setShowAddForm(false);
      toast.success('Owner created');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to create owner'
      );
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast.error('Owner name is required');
      return;
    }
    try {
      await onUpdate(editing.id, {
        name: editing.name.trim(),
        color: editing.color,
        contactInfo: editing.contactInfo.trim() || null,
      });
      setEditing(null);
      toast.success('Owner updated');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update owner'
      );
    }
  };

  const handleDelete = async (owner: Owner) => {
    const assignedTasks = tasks.filter((t) => t.ownerId === owner.id);
    const confirmMsg =
      assignedTasks.length > 0
        ? `"${owner.name}" is assigned to ${assignedTasks.length} task(s). They will become "Unassigned". Delete anyway?`
        : `Delete "${owner.name}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await onDelete(owner.id);
      toast.success('Owner deleted');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete owner'
      );
    }
  };

  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="outline" size="sm" />}
      >
        Manage Owners
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Owners</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          {/* Owner list */}
          {owners.map((owner) =>
            editing?.id === owner.id ? (
              <div
                key={owner.id}
                className="grid gap-2 rounded-lg border border-border p-2"
              >
                <Input
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                  placeholder="Name"
                />
                <div className="flex gap-2">
                  <Input
                    value={editing.color}
                    onChange={(e) =>
                      setEditing({ ...editing, color: e.target.value })
                    }
                    placeholder="#hex color"
                    className="w-28"
                  />
                  <span
                    className="inline-block size-8 shrink-0 rounded border border-border"
                    style={{ backgroundColor: editing.color }}
                  />
                  <Input
                    value={editing.contactInfo}
                    onChange={(e) =>
                      setEditing({ ...editing, contactInfo: e.target.value })
                    }
                    placeholder="Contact info"
                    className="flex-1"
                  />
                </div>
                <div className="flex gap-1">
                  <Button size="xs" onClick={handleUpdate}>
                    <Check data-icon="inline-start" /> Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setEditing(null)}
                  >
                    <X data-icon="inline-start" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div
                key={owner.id}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
              >
                <span
                  className="inline-block size-4 shrink-0 rounded-full"
                  style={{ backgroundColor: owner.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {owner.name}
                  </div>
                  {owner.contactInfo && (
                    <div className="text-xs text-muted-foreground truncate">
                      {owner.contactInfo}
                    </div>
                  )}
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() =>
                      setEditing({
                        id: owner.id,
                        name: owner.name,
                        color: owner.color,
                        contactInfo: owner.contactInfo ?? '',
                      })
                    }
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon-xs"
                    onClick={() => handleDelete(owner)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            )
          )}

          {owners.length === 0 && !showAddForm && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No owners yet.
            </p>
          )}

          {/* Add form */}
          {showAddForm ? (
            <div className="grid gap-2 rounded-lg border border-dashed border-border p-2">
              <Label className="text-xs text-muted-foreground">
                New Owner
              </Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name (required)"
              />
              <div className="flex gap-2">
                <Input
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  placeholder="#hex color"
                  className="w-28"
                />
                <span
                  className="inline-block size-8 shrink-0 rounded border border-border"
                  style={{ backgroundColor: newColor }}
                />
                <Input
                  value={newContact}
                  onChange={(e) => setNewContact(e.target.value)}
                  placeholder="Contact info (optional)"
                  className="flex-1"
                />
              </div>
              <div className="flex gap-1">
                <Button size="xs" onClick={handleAdd}>
                  <Check data-icon="inline-start" /> Add
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setShowAddForm(false)}
                >
                  <X data-icon="inline-start" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowAddForm(true)}
            >
              <Plus data-icon="inline-start" /> Add Owner
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
