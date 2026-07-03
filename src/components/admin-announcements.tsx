import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { format } from "date-fns";
import { Trash2, Pencil, ExternalLink } from "lucide-react";

type Announcement = {
  id: string;
  title: string | null;
  image_url: string;
  link_url: string | null;
  start_at: string;
  end_at: string;
  priority: number;
  is_active: boolean;
  created_at: string;
};

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ManageAnnouncements() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Announcement | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Announcement[];
    },
  });

  const remove = useMutation({
    mutationFn: async (row: Announcement) => {
      // Best-effort delete storage object first
      await supabase.storage.from("announcements").remove([row.image_url]);
      const { error } = await supabase.from("announcements").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Announcement deleted");
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      qc.invalidateQueries({ queryKey: ["active-announcement"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const now = new Date();
  const groups = {
    published: items.filter((a) => a.is_active && new Date(a.start_at) <= now && new Date(a.end_at) >= now),
    scheduled: items.filter((a) => new Date(a.start_at) > now),
    expired: items.filter((a) => new Date(a.end_at) < now),
    inactive: items.filter((a) => !a.is_active && new Date(a.end_at) >= now && new Date(a.start_at) <= now),
  };

  return (
    <div className="space-y-6">
      <AnnouncementForm
        key={editing?.id ?? "new"}
        editing={editing}
        onDone={() => {
          setEditing(null);
          qc.invalidateQueries({ queryKey: ["admin-announcements"] });
          qc.invalidateQueries({ queryKey: ["active-announcement"] });
        }}
        onCancel={() => setEditing(null)}
      />

      {isLoading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      ) : (
        <div className="space-y-6">
          <Section title="Live" rows={groups.published} onEdit={setEditing} onDelete={(r) => remove.mutate(r)} tone="neon" />
          <Section title="Scheduled" rows={groups.scheduled} onEdit={setEditing} onDelete={(r) => remove.mutate(r)} />
          <Section title="Inactive" rows={groups.inactive} onEdit={setEditing} onDelete={(r) => remove.mutate(r)} />
          <Section title="Expired" rows={groups.expired} onEdit={setEditing} onDelete={(r) => remove.mutate(r)} />
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  rows,
  onEdit,
  onDelete,
  tone,
}: {
  title: string;
  rows: Announcement[];
  onEdit: (a: Announcement) => void;
  onDelete: (a: Announcement) => void;
  tone?: "neon";
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h3 className={`mb-2 text-xs font-bold uppercase tracking-wider ${tone === "neon" ? "text-neon" : "text-muted-foreground"}`}>
        {title} · {rows.length}
      </h3>
      <div className="space-y-2">
        {rows.map((r) => (
          <Row key={r.id} row={r} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

function Row({ row, onEdit, onDelete }: { row: Announcement; onEdit: (a: Announcement) => void; onDelete: (a: Announcement) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-3 shadow-card">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{row.title || "(untitled)"}</div>
        <div className="text-[11px] text-muted-foreground">
          {format(new Date(row.start_at), "MMM d HH:mm")} → {format(new Date(row.end_at), "MMM d HH:mm")} · P{row.priority}
          {!row.is_active && " · inactive"}
        </div>
        {row.link_url && (
          <a
            href={row.link_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-neon hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> {row.link_url}
          </a>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" onClick={() => onEdit(row)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="text-destructive"
          onClick={() => {
            if (confirm("Delete this announcement?")) onDelete(row);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function AnnouncementForm({
  editing,
  onDone,
  onCancel,
}: {
  editing: Announcement | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [linkUrl, setLinkUrl] = useState(editing?.link_url ?? "");
  const [startAt, setStartAt] = useState(editing ? toLocalInput(editing.start_at) : toLocalInput(new Date().toISOString()));
  const [endAt, setEndAt] = useState(
    editing ? toLocalInput(editing.end_at) : toLocalInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()),
  );
  const [priority, setPriority] = useState(editing?.priority ?? 0);
  const [isActive, setIsActive] = useState(editing?.is_active ?? true);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let imagePath = editing?.image_url ?? "";
      if (file) {
        const ext = file.name.split(".").pop() || "png";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("announcements").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (upErr) throw upErr;
        if (editing?.image_url) {
          await supabase.storage.from("announcements").remove([editing.image_url]);
        }
        imagePath = path;
      }
      if (!imagePath) throw new Error("Please upload a poster image");

      const payload = {
        title: title.trim() || null,
        image_url: imagePath,
        link_url: linkUrl.trim() || null,
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
        priority,
        is_active: isActive,
      };

      if (editing) {
        const { error } = await supabase.from("announcements").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Announcement updated");
      } else {
        const { error } = await supabase.from("announcements").insert(payload);
        if (error) throw error;
        toast.success("Announcement created");
      }
      setFile(null);
      if (!editing) {
        setTitle(""); setLinkUrl(""); setPriority(0); setIsActive(true);
      }
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-neon">
          {editing ? "Edit announcement" : "New announcement"}
        </h3>
        {editing && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel edit
          </Button>
        )}
      </div>
      <div>
        <Label>Poster image {editing && <span className="text-xs text-muted-foreground">(leave empty to keep current)</span>}</Label>
        <Input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required={!editing}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Title (optional)</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Big weekend fixtures" />
        </div>
        <div>
          <Label>Destination URL (optional)</Label>
          <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Start</Label>
          <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
        </div>
        <div>
          <Label>End</Label>
          <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} required />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Priority (higher shows first)</Label>
          <Input
            type="number"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value) || 0)}
          />
        </div>
        <div className="flex items-end gap-3">
          <div className="flex items-center gap-3 rounded-lg border bg-background/50 px-3 py-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="active" />
            <Label htmlFor="active" className="cursor-pointer">Active</Label>
          </div>
        </div>
      </div>
      <Button disabled={saving} className="bg-emerald text-emerald-foreground hover:bg-emerald/90">
        {saving ? "Saving…" : editing ? "Save changes" : "Publish"}
      </Button>
    </form>
  );
}
