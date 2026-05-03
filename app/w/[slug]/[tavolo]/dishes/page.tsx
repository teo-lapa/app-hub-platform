import { redirect } from 'next/navigation';

// Deprecated: la pagina /dishes è stata sostituita da /chat (sommelier conversazionale).
// Manteniamo la route con redirect 308 per QR già stampati.
export default function DishesRedirect({ params }: { params: { slug: string; tavolo: string } }) {
  redirect(`/w/${params.slug}/${params.tavolo}/chat`);
}
