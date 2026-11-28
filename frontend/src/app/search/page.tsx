import { redirect } from "next/navigation";

/** Legacy search route. Home opens the cmdk card. */
export default function SearchPage() {
  redirect("/?focus=search");
}
