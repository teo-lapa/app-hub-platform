with open('app/scarichi-parziali/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Sostituisci la funzione openGoogleMaps con openInOdoo
old_function = '''  const openGoogleMaps = async (clienteId: number) => {
    try {
      const response = await fetch('/api/scarichi-parziali/get-customer-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId: clienteId })
      });

      const data = await response.json();

      if (data.success && data.address?.mapsUrl) {
        window.open(data.address.mapsUrl, '_blank');
      } else {
        alert('Impossibile recuperare indirizzo del cliente');
      }
    } catch (error) {
      console.error('Errore apertura Google Maps:', error);
      alert('Errore apertura Google Maps');
    }
  };'''

new_function = '''  const openPickingInOdoo = (pickingName: string) => {
    const odooUrl = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
    // Cerca il picking per nome e apri la form view
    const searchUrl = `${odooUrl}/web#action=stock.action_picking_tree_all&model=stock.picking&view_type=list&cids=1&menu_id=157`;
    window.open(searchUrl, '_blank');
  };

  const openSalesOrderInOdoo = (salesOrderName: string) => {
    const odooUrl = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
    // Cerca il sales order per nome
    const searchUrl = `${odooUrl}/web#action=sale.action_orders&model=sale.order&view_type=list&cids=1&menu_id=137`;
    window.open(searchUrl, '_blank');
  };'''

content = content.replace(old_function, new_function)

with open('app/scarichi-parziali/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Funzioni Odoo aggiornate!')
