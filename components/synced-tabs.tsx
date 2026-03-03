"use client";

import { Tabs } from "@/components/ui/tabs";
import { useActiveTab } from "@/components/active-tab-context";

export function SyncedTabs({
  children,
  defaultValue,
  className,
}: {
  children: React.ReactNode;
  defaultValue: string;
  className?: string;
}) {
  const { setActiveTab } = useActiveTab();
  return (
    <Tabs
      defaultValue={defaultValue}
      className={className}
      onValueChange={setActiveTab}
    >
      {children}
    </Tabs>
  );
}
