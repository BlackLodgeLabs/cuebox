import { redirect } from "next/navigation";

/** Alias — shared picker lives on Home with ?focus=search. */
export default function SearchPage() {
  redirect("/?focus=search");
}
