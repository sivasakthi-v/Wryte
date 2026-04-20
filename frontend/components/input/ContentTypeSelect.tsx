"use client";

import type { ContentType } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const OPTIONS: { value: ContentType; label: string }[] = [
  { value: "generic", label: "Generic" },
  { value: "landing_page", label: "Landing page" },
  { value: "blog_post", label: "Blog post" },
  { value: "ad_copy", label: "Ad copy" },
  { value: "email", label: "Email" },
  { value: "social_post", label: "Social post" },
  { value: "doc", label: "Documentation" },
];

export function ContentTypeSelect({
  value,
  onChange,
}: {
  value: ContentType;
  onChange: (v: ContentType) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="content-type" className="text-xs uppercase tracking-wide text-muted-foreground">
        Content type
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v as ContentType)}>
        <SelectTrigger id="content-type" className="h-9 w-full">
          <SelectValue placeholder="Choose..." />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
