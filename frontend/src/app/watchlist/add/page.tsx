import { redirect } from "next/navigation";

/** Legacy add path. Home opens the cmdk card. */
export default function AddFilmPage() {
  redirect("/?focus=search");
}
