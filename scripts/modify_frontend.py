import re

# Leggi il file
with open('app/scarichi-parziali/page.tsx.backup2', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Aggiungi i nuovi campi all'interfaccia ResidualOrder
content = content.replace(
    '''interface ResidualOrder {
  numeroOrdineResiduo: string;
  cliente: string;
  dataPrevisita: string;
  salesOrder: string;
  outCompletato: string;
  prodottiNonScaricati: ProductNotDelivered[];
  messaggiScaricoParziale: PartialDischargeMessage[];
  haScarichiParziali: boolean;
}''',
    '''interface ResidualOrder {
  numeroOrdineResiduo: string;
  cliente: string;
  clienteId: number;
  dataPrevisita: string;
  salesOrder: string;
  outCompletato: string;
  prodottiNonScaricati: ProductNotDelivered[];
  messaggiScaricoParziale: PartialDischargeMessage[];
  haScarichiParziali: boolean;
  autista?: string;
  veicolo?: string;
  returnCreated?: boolean;
}'''
)

# 2. Aggiungi import per User icon
content = content.replace(
    '''  RefreshCw
} from 'lucide-react';''',
    '''  RefreshCw,
  User,
  Car,
  ExternalLink,
  Volume2,
  Image as ImageIcon,
  X
} from 'lucide-react';'''
)

# 3. Aggiungi state per modal motivazione
content = content.replace(
    '''  const [creatingTransfer, setCreatingTransfer] = useState<string | null>(null);''',
    '''  const [creatingTransfer, setCreatingTransfer] = useState<string | null>(null);
  const [selectedOrderForMotivation, setSelectedOrderForMotivation] = useState<ResidualOrder | null>(null);'''
)

# Scrivi solo queste modifiche per ora
with open('app/scarichi-parziali/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Parte 1 completata!')
