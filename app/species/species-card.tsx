"use client";
/*
Note: "use client" is a Next.js App Router directive that tells React to render the component as
a client component rather than a server component. This establishes the server-client boundary,
providing access to client-side functionality such as hooks and event handlers to this component and
any of its imported children. Although the SpeciesCard component itself does not use any client-side
functionality, it is beneficial to move it to the client because it is rendered in a list with a unique
key prop in species/page.tsx. When multiple component instances are rendered from a list, React uses the unique key prop
on the client-side to correctly match component state and props should the order of the list ever change.
React server components don't track state between rerenders, so leaving the uniquely identified components (e.g. SpeciesCard)
can cause errors with matching props and state in child components if the list order changes.
*/
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { createBrowserSupabaseClient } from "@/lib/client-utils";
import type { Database } from "@/lib/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type BaseSyntheticEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Comment from "./comment";

const kingdoms = z.enum(["Animalia", "Plantae", "Fungi", "Protista", "Archaea", "Bacteria"]);

// Use Zod to define the shape + requirements of a Species entry; used in form validation
const speciesSchema = z.object({
  scientific_name: z
    .string()
    .optional()
    .transform((val) => val?.trim()),
  common_name: z
    .string()
    .optional()
    // Transform empty string or only whitespace input to null before form submission, and trim whitespace otherwise
    .transform((val) => (!val || val.trim() === "" ? "" : val.trim())),
  kingdom: kingdoms.optional(),
  total_population: z.number().int().positive().min(1).optional(),
  image: z
    .string()
    .url()
    .optional()
    // Transform empty string or only whitespace input to null before form submission, and trim whitespace otherwise
    .transform((val) => (!val || val.trim() === "" ? "" : val.trim())),
  description: z
    .string()
    .optional()
    // Transform empty string or only whitespace input to null before form submission, and trim whitespace otherwise
    .transform((val) => (!val || val.trim() === "" ? "" : val.trim())),
});

type FormData = z.infer<typeof speciesSchema>;
type Species = Database["public"]["Tables"]["species"]["Row"];

// Default values for the form fields.
/* Because the react-hook-form (RHF) used here is a controlled form (not an uncontrolled form),
fields that are nullable/not required should explicitly be set to `null` by default.
Otherwise, they will be `undefined` by default, which will raise warnings because `undefined` conflicts with controlled components.
All form fields should be set to non-undefined default values.
Read more here: https://legacy.react-hook-form.com/api/useform/
*/
const values: Partial<FormData> = {};

export default function SpeciesCard({ species }: { species: Species }) {
  const router = useRouter();
  const [open, setOpen] = useState<boolean>(false);
  const [openEdit, setOpenEdit] = useState<boolean>(false);
  const supabase = createBrowserSupabaseClient();

  const [isUser, setIsUser] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user.id && species.author === session.user.id) {
        setIsUser(true);
      } else {
        setIsUser(false);
      }
    };

    checkAuth();
  }, [species.author]);

  const submitEdit = async (input: FormData) => {
    // The `input` prop contains data that has already been processed by zod. We can now use it in a supabase query

    const { error } = await supabase
      .from("species")
      .update({
        common_name: input.common_name,
        description: input.description,
        kingdom: input.kingdom,
        scientific_name: input.scientific_name,
        total_population: input.total_population,
        image: input.image,
      })
      .eq("id", species.id);

    // Catch and report errors from Supabase and exit the onSubmit function with an early 'return' if an error occurred.
    if (error) {
      alert(error);
      toast({
        title: "Something went wrong.",
        description: error.message,
        variant: "destructive",
      });
    }

    // Because Supabase errors were caught above, the remainder of the function will only execute upon a successful edit

    // Reset form values to the default (empty) values.
    // Practically, this line can be removed because router.refresh() also resets the form. However, we left it as a reminder that you should generally consider form "cleanup" after an add/edit operation.
    form.reset(values);

    setOpenEdit(false);

    // Refresh all server components in the current route. This helps display the newly created species because species are fetched in a server component, species/page.tsx.
    // Refreshing that server component will display the new species from Supabase
    router.refresh();

    return toast({
      title: "New species added!",
      description: "Successfully changed " + input.scientific_name + ".",
    });
  };

  const form = useForm<FormData>({
    resolver: zodResolver(speciesSchema),
    defaultValues: {
      scientific_name: species.scientific_name || "",
      common_name: species.common_name || "",
      kingdom: species.kingdom || "Animalia",
      total_population: species.total_population ?? undefined,
      image: species.image || "",
      description: species.description || "",
    },
    mode: "onChange",
  });

  return (
    <div>
      <div className="m-4 w-72 min-w-72 flex-none rounded border-2 p-3 shadow">
        {species.image && (
          <div className="relative h-40 w-full">
            <Image src={species.image} alt={species.scientific_name} fill style={{ objectFit: "cover" }} />
          </div>
        )}
        <h3 className="mt-3 text-2xl font-semibold">{species.scientific_name}</h3>
        <h4 className="text-lg font-light italic">{species.common_name}</h4>
        <p>{species.description ? species.description.slice(0, 150).trim() + "..." : ""}</p>
        {/* Replace the button with the detailed view dialog. */}

        <Dialog open={open} onOpenChange={setOpen}>
          <div className="flex">
            <DialogTrigger asChild>
              <Button className="float-left mt-3 w-full">Learn More</Button>
            </DialogTrigger>
            <div className="float-right flex">
              {/* COMMENTS DIALOG */}
              <Comment speciesId={species.id}></Comment>
              {/* END COMMENTS DIALOG */}
            </div>
          </div>
          <DialogContent className="max-h-screen overflow-y-auto sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{species.scientific_name}</DialogTitle>
              <DialogDescription>
                <i>{species.common_name}</i>
              </DialogDescription>
            </DialogHeader>

            <p>{species.description}</p>
            <h3>
              <b>Population</b>
              <p>{species.total_population}</p>
            </h3>
            <h3>
              <b>Kingdom</b>
              <p>{species.kingdom}</p>
            </h3>
          </DialogContent>
        </Dialog>
        <div className="w-full">
          {/* Start Editing Modal */}
          <Dialog open={openEdit} onOpenChange={setOpenEdit}>
            <DialogTrigger>
              {isUser && (
                <Button variant="ghost" className="float-rightmt-3">
                  <Icons.settings className="p-0" />
                </Button>
              )}
            </DialogTrigger>

            <DialogContent className="max-h-screen overflow-y-auto sm:max-w-[600px]">
              <DialogTitle>Edit {species.scientific_name}</DialogTitle>
              <Form {...form}>
                <form onSubmit={(e: BaseSyntheticEvent) => void form.handleSubmit(submitEdit)(e)}>
                  <div className="grid w-full items-center gap-4">
                    <FormField
                      control={form.control}
                      name="scientific_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Edit Scientific Name</FormLabel>
                          <FormControl>
                            <Input defaultValue={species.scientific_name} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="common_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Edit Common Name</FormLabel>
                          <FormControl>
                            <Input defaultValue={species.common_name || ""} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="kingdom"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Kingdom</FormLabel>
                          <Select onValueChange={(value) => field.onChange(kingdoms.parse(value))} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue></SelectValue>
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectGroup defaultValue={species.kingdom}>
                                {kingdoms.options.map((kingdom, index) => (
                                  <SelectItem key={index} value={kingdom}>
                                    {kingdom}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="total_population"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Edit Population</FormLabel>
                          <Input
                            defaultValue={species.total_population || ""}
                            type="number"
                            onChange={(event) => field.onChange(+event.target.value)}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="image"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Edit Image</FormLabel>
                          <FormControl>
                            <Input defaultValue={species.image || ""} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Edit Description</FormLabel>
                          <FormControl>
                            <Input defaultValue={species.description || ""} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex">
                      <Button type="submit" className="ml-1 mr-1 flex-auto">
                        Save Changes
                      </Button>
                      <DialogClose asChild>
                        <Button type="button" className="ml-1 mr-1 flex-auto" variant="secondary">
                          Cancel
                        </Button>
                      </DialogClose>
                    </div>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
