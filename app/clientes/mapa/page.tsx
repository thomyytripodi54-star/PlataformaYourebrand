import { redirect } from "next/navigation";

export default function Mapa() {
  redirect("/clientes/dashboard?vista=geografia");
}
