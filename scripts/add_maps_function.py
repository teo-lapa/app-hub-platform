with open('app/scarichi-parziali/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Aggiungi la funzione openGoogleMaps dopo handleCreateReturn
maps_function = '''
  const openGoogleMaps = async (clienteId: number) => {
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
  };
'''

# Trova la posizione dopo handleCreateReturn e prima di getReasonSummary
insert_pos = content.find('  const getReasonSummary = (order: ResidualOrder): string => {')
if insert_pos > 0:
    content = content[:insert_pos] + maps_function + '\n' + content[insert_pos:]
    
with open('app/scarichi-parziali/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Funzione Google Maps aggiunta!')
