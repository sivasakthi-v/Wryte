"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FocusKeywordInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label
        htmlFor="focus-keyword"
        className="text-xs uppercase tracking-wide text-muted-foreground"
      >
        Focus keyword
      </Label>
      <Input
        id="focus-keyword"
        placeholder="e.g. content scoring tool"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9"
      />
    </div>
  );
}
