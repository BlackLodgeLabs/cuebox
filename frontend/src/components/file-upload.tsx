"use client";

import { useCallback, useRef, useState } from "react";
import { Upload } from "lucide-react";
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
        "flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-8 transition-colors",
        dragOver && "border-primary bg-accent/50",
        disabled && "pointer-events-none opacity-50",
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
      <Upload className="h-10 w-10 text-muted-foreground" />
      <div className="text-center">
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">
          Drag and drop a Letterboxd watchlist CSV, or click to browse
        </p>
        {selectedName && (
          <p className="mt-2 text-sm text-primary">Selected: {selectedName}</p>
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
