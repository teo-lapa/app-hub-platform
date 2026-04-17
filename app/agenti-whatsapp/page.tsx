import { redirect } from 'next/navigation';

// Old /agenti-whatsapp dashboard is unified into /infra-monitor.
// Detail pages (/agenti-whatsapp/[nome]) and /agenti-whatsapp/alerts still work.
export default function AgentiWhatsAppPage() {
  redirect('/infra-monitor');
}
