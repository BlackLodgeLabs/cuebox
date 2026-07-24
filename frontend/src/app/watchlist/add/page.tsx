import { redirect } from "next/navigation";

/** Legacy add path — chains through /search → Home focus. */
export default function AddFilmPage() {
  redirect("/search");
}
