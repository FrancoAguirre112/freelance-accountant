"use client";

import { Tabs } from "@/components/ui/tabs";
import { useActiveTab } from "@/components/active-tab-context";

export function SyncedTabs({
  children,
  className,
}: {
  children: React.ReactNode;
  defaultValue?: string;
  className?: string;
}) {
  const { activeTab, setActiveTab } = useActiveTab();
  return (
    <Tabs
      value={activeTab}
      className={className}
      onValueChange={setActiveTab}
    >
      {children}
    </Tabs>
  );
}
