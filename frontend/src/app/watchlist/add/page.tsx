import { redirect } from "next/navigation";

/** Legacy add path — shared picker lives at /search. */
export default function AddFilmPage() {
  redirect("/search?intent=add");
}
