"use client";

import { useCallback, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  disabled?: boolean;
  label?: string;
}

export function FileUpload({
  onFileSelect,
  accept = ".csv",
  disabled = false,
  label = "Upload CSV",
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!file.name.toLowerCase().endsWith(".csv")) {
        return;
      }
      setSelectedName(file.name);
      onFileSelect(file);
    },
    [onFileSelect],
  );

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded border-2 border-dashed border-border bg-card p-8 transition-all",
        dragOver && "border-secondary shadow-glow",
        disabled && "pointer-events-none opacity-50 grayscale",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFile(e.dataTransfer.files[0]);
      }}
    >
      <Icon name="upload" size={40} className="text-muted-foreground" />
      <div className="text-center">
        <p className="text-body-lg font-medium">{label}</p>
        <p className="text-body-md text-muted-foreground">
          Drag and drop a Letterboxd watchlist CSV, or click to browse
        </p>
        {selectedName && (
          <p className="mt-2 text-label-md normal-case tracking-normal text-primary">
            Selected: {selectedName}
          </p>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <Button
        type="button"
        variant="secondary"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      >
        Choose file
      </Button>
    </div>
  );
}
