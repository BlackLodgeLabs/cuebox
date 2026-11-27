"use client";

import * as React from "react";
import { Drawer } from "vaul";
import { Icon } from "@/components/icon";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { sheetCloseThreshold, sheetMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

type SheetSide = "top" | "bottom" | "left" | "right";

type SheetMotionApi = {
  setCloseThreshold: (value: number) => void;
  setDirection: (side: SheetSide) => void;
};

const SheetMotionContext = React.createContext<SheetMotionApi | null>(null);

function Sheet(props: React.ComponentProps<typeof Drawer.Root>) {
  const [closeThreshold, setCloseThreshold] = React.useState(1);
  const [direction, setDirection] = React.useState<SheetSide>("bottom");
  const api = React.useMemo(
    () => ({ setCloseThreshold, setDirection }),
    [],
  );

  return (
    <SheetMotionContext.Provider value={api}>
      <Drawer.Root
        {...props}
        direction={direction}
        closeThreshold={closeThreshold}
        shouldScaleBackground={false}
      />
    </SheetMotionContext.Provider>
  );
}

const SheetTrigger = Drawer.Trigger;
const SheetPortal = Drawer.Portal;
const SheetClose = Drawer.Close;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof Drawer.Overlay>,
  React.ComponentPropsWithoutRef<typeof Drawer.Overlay>
>(({ className, ...props }, ref) => {
  const reduced = useReducedMotion();
  const motion = sheetMotion(reduced);
  return (
    <Drawer.Overlay
      ref={ref}
      data-cb-sheet-overlay=""
      data-dim={motion.dim}
      data-dim-fade-ms={motion.dimFadeMs}
      className={cn("cb-sheet-overlay fixed inset-0 z-50", className)}
      style={{
        ["--cb-sheet-dim" as string]: String(motion.dim),
        ["--cb-sheet-dim-fade" as string]: `${motion.dimFadeMs}ms`,
      }}
      {...props}
    />
  );
});
SheetOverlay.displayName = "SheetOverlay";

const sideClass: Record<SheetSide, string> = {
  bottom: "inset-x-0 bottom-0 rounded-t-cb-lg border-t",
  top: "inset-x-0 top-0 rounded-b-cb-lg border-b",
  left: "inset-y-0 left-0 h-full w-3/4 rounded-r-cb-lg border-r sm:max-w-sm",
  right: "inset-y-0 right-0 h-full w-3/4 rounded-l-cb-lg border-l sm:max-w-sm",
};

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof Drawer.Content> {
  side?: SheetSide;
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof Drawer.Content>,
  SheetContentProps
>(({ side = "bottom", className, children, ...props }, ref) => {
  const reduced = useReducedMotion();
  const motion = sheetMotion(reduced);
  const api = React.useContext(SheetMotionContext);
  const localRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    api?.setDirection(side);
    const height = localRef.current?.getBoundingClientRect().height ?? 0;
    if (height > 0) {
      api?.setCloseThreshold(sheetCloseThreshold(height, motion.dismissPx));
    }
  }, [api, motion.dismissPx, side]);

  return (
    <SheetPortal>
      <SheetOverlay />
      <Drawer.Content
        ref={(node) => {
          localRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        data-cb-sheet=""
        data-cb-reduced={reduced ? "true" : "false"}
        data-travel={motion.travel}
        data-dismiss-px={motion.dismissPx}
        data-open-ms={motion.openMs}
        data-close-ms={motion.closeMs}
        className={cn(
          "cb-sheet fixed z-50 flex max-h-[90vh] flex-col gap-4 border-cb-divider bg-cb-surface p-6 outline-none",
          sideClass[side],
          className,
        )}
        style={{
          ["--cb-sheet-up" as string]: `${motion.openMs}ms`,
          ["--cb-sheet-down" as string]: `${motion.closeMs}ms`,
        }}
        {...props}
      >
        <Drawer.Handle className="cb-sheet-handle" aria-hidden>
          <span className="block h-1.5 w-10 rounded-full bg-cb-muted" />
        </Drawer.Handle>
        <Drawer.Close className="absolute right-4 top-4 rounded-cb text-cb-muted hover:text-cb-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-accent">
          <Icon name="close" size={16} />
          <span className="sr-only">Close</span>
        </Drawer.Close>
        {children}
      </Drawer.Content>
    </SheetPortal>
  );
});
SheetContent.displayName = "SheetContent";

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col space-y-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mt-auto flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof Drawer.Title>,
  React.ComponentPropsWithoutRef<typeof Drawer.Title>
>(({ className, ...props }, ref) => (
  <Drawer.Title
    ref={ref}
    className={cn("font-display text-cb-section text-cb-text", className)}
    {...props}
  />
));
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof Drawer.Description>,
  React.ComponentPropsWithoutRef<typeof Drawer.Description>
>(({ className, ...props }, ref) => (
  <Drawer.Description
    ref={ref}
    className={cn("font-ui text-cb-caption text-cb-muted", className)}
    {...props}
  />
));
SheetDescription.displayName = "SheetDescription";

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
