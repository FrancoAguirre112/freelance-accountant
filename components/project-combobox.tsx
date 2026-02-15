"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Project {
  id: number;
  name: string;
}

interface ProjectComboboxProps {
  projects: Project[];
  name?: string; // The name attribute for the hidden input
  required?: boolean;
}

export function ProjectCombobox({
  projects,
  name,
  required,
}: ProjectComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(""); // This will hold the project ID as a string

  const selectedProject = projects.find(
    (project) => project.id.toString() === value,
  );

  return (
    <div className="flex flex-col w-full">
      {/* Hidden input to pass the ID to the form action */}
      <input type="hidden" name={name} value={value} required={required} />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="justify-between w-full font-normal"
          >
            {value ? (
              selectedProject?.name
            ) : (
              <span className="text-muted-foreground">Buscar proyecto...</span>
            )}
            <ChevronsUpDown className="opacity-50 ml-2 w-4 h-4 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[--radix-popover-trigger-width]"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Buscar proyecto..." />
            <CommandList>
              <CommandEmpty>No se encontró el proyecto.</CommandEmpty>
              <CommandGroup>
                {/* Optional: Add a "None" option if you want to unselect */}
                <CommandItem
                  value="none"
                  onSelect={() => {
                    setValue("");
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 w-4 h-4",
                      value === "" ? "opacity-100" : "opacity-0",
                    )}
                  />
                  Ninguno (Sin vincular)
                </CommandItem>

                {projects.map((project) => (
                  <CommandItem
                    key={project.id}
                    value={project.name} // Search by name
                    onSelect={() => {
                      setValue(project.id.toString()); // Store ID
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 w-4 h-4",
                        value === project.id.toString()
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    {project.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
