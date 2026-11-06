"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  /** When provided, keeps the displayed selection in sync with parent state. */
  selectedFile?: File | null;
  accept?: string;
  disabled?: boolean;
  label?: string;
  /** Phone-first density: smaller chrome, Choose file primary. */
  variant?: "default" | "compact";
}

export function FileUpload({
  onFileSelect,
  selectedFile,
  accept = ".csv",
  disabled = false,
  label = "Upload CSV",
  variant = "default",
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const { toast } = useToast();
  const compact = variant === "compact";

  useEffect(() => {
    if (selectedFile === undefined) return;
    setSelectedName(selectedFile?.name ?? null);
    if (!selectedFile && inputRef.current) {
      inputRef.current.value = "";
    }
  }, [selectedFile]);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!file.name.toLowerCase().endsWith(".csv")) {
        toast({
          variant: "destructive",
          title: "Invalid file type",
          description: "Please select a CSV file.",
        });
        return;
      }
      setSelectedName(file.name);
      onFileSelect(file);
    },
    [onFileSelect, toast],
  );

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded border-2 border-dashed border-border bg-card transition-all",
        compact ? "gap-2 p-4" : "gap-4 p-8",
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
      <Icon
        name="upload"
        size={compact ? 28 : 40}
        className="text-muted-foreground"
      />
      <div className="text-center">
        <p className="text-body-lg font-medium">{label}</p>
        {compact ? (
          <>
            <p className="text-body-md text-muted-foreground md:hidden">
              Tap to choose a CSV
            </p>
            <p className="hidden text-body-md text-muted-foreground md:block">
              Drag and drop a Letterboxd watchlist CSV, or click to browse
            </p>
          </>
        ) : (
          <p className="text-body-md text-muted-foreground">
            Drag and drop a Letterboxd watchlist CSV, or click to browse
          </p>
        )}
        {selectedName && (
          <p className="mt-2 min-w-0 break-all text-label-md normal-case tracking-normal text-primary">
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
        size={compact ? "lg" : "default"}
        className={cn(compact && "min-h-11")}
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      >
        Choose file
      </Button>
    </div>
  );
}
