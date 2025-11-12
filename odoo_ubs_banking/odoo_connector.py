"""
Connettore Odoo XML-RPC per gestione movimenti bancari
"""

import xmlrpc.client
import ssl
from typing import Dict, List, Any, Optional
from datetime import datetime
import config


class OdooConnector:
    """Gestisce la connessione a Odoo via XML-RPC"""

    def __init__(self, url: str = None, db: str = None, username: str = None, password: str = None):
        """
        Inizializza connessione Odoo

        Args:
            url: URL Odoo (default da config)
            db: Database Odoo (default da config)
            username: Username (default da config)
            password: Password (default da config)
        """
        self.url = url or config.ODOO_URL
        self.db = db or config.ODOO_DB
        self.username = username or config.ODOO_USERNAME
        self.password = password or config.ODOO_PASSWORD

        self.uid = None
        self.models = None
        self.common = None

    def connect(self) -> bool:
        """
        Connette a Odoo e autentica l'utente

        Returns:
            bool: True se connessione riuscita
        """
        try:
            # Crea contesto SSL non verificato (per staging)
            context = ssl._create_unverified_context()

            # Connessione common (autenticazione)
            common_url = f"{self.url}/xmlrpc/2/common"
            self.common = xmlrpc.client.ServerProxy(common_url, context=context)

            # Autenticazione
            self.uid = self.common.authenticate(
                self.db,
                self.username,
                self.password,
                {}
            )

            if not self.uid:
                print("❌ Autenticazione fallita!")
                return False

            # Connessione models (operazioni)
            models_url = f"{self.url}/xmlrpc/2/object"
            self.models = xmlrpc.client.ServerProxy(models_url, context=context)

            print(f"✅ Connesso a Odoo come UID {self.uid}")
            return True

        except Exception as e:
            print(f"❌ Errore connessione: {e}")
            return False

    def execute(self, model: str, method: str, *args, **kwargs) -> Any:
        """
        Esegue un metodo su un modello Odoo

        Args:
            model: Nome modello (es. 'account.bank.statement.line')
            method: Nome metodo (es. 'search', 'read', 'create')
            *args: Argomenti posizionali
            **kwargs: Argomenti nominali

        Returns:
            Risultato del metodo
        """
        if not self.uid or not self.models:
            raise Exception("Non connesso a Odoo. Chiama connect() prima.")

        return self.models.execute_kw(
            self.db,
            self.uid,
            self.password,
            model,
            method,
            args,
            kwargs
        )

    def search_read(self, model: str, domain: List = None, fields: List[str] = None,
                    limit: int = None, order: str = None) -> List[Dict]:
        """
        Cerca e legge record da un modello

        Args:
            model: Nome modello
            domain: Filtri ricerca (formato Odoo domain)
            fields: Campi da leggere
            limit: Limite risultati
            order: Ordinamento

        Returns:
            Lista di dizionari con i dati
        """
        if domain is None:
            domain = []
        kwargs = {}

        if fields:
            kwargs['fields'] = fields
        if limit:
            kwargs['limit'] = limit
        if order:
            kwargs['order'] = order

        return self.execute(model, 'search_read', [domain], kwargs)

    def create(self, model: str, values: Dict) -> int:
        """
        Crea un nuovo record

        Args:
            model: Nome modello
            values: Dizionario con i valori

        Returns:
            ID del record creato
        """
        return self.execute(model, 'create', [values])

    def write(self, model: str, ids: List[int], values: Dict) -> bool:
        """
        Aggiorna record esistenti

        Args:
            model: Nome modello
            ids: Lista ID record da aggiornare
            values: Dizionario con i valori da aggiornare

        Returns:
            True se successo
        """
        return self.execute(model, 'write', [ids, values])

    def unlink(self, model: str, ids: List[int]) -> bool:
        """
        Elimina record

        Args:
            model: Nome modello
            ids: Lista ID record da eliminare

        Returns:
            True se successo
        """
        return self.execute(model, 'unlink', [ids])

    def get_fields(self, model: str, attributes: List[str] = None) -> Dict:
        """
        Ottiene definizione campi di un modello

        Args:
            model: Nome modello
            attributes: Attributi da includere

        Returns:
            Dizionario con definizione campi
        """
        attributes = attributes or ['string', 'type', 'required', 'readonly', 'help']
        return self.execute(model, 'fields_get', [], {'attributes': attributes})


class BankStatementManager:
    """Gestisce gli estratti conto bancari in Odoo"""

    def __init__(self, connector: OdooConnector):
        """
        Inizializza manager

        Args:
            connector: Istanza OdooConnector connessa
        """
        self.odoo = connector

    def get_journal_info(self, journal_id: int) -> Optional[Dict]:
        """
        Ottiene informazioni su un giornale bancario

        Args:
            journal_id: ID giornale

        Returns:
            Dizionario con info giornale o None
        """
        journals = self.odoo.search_read(
            'account.journal',
            [('id', '=', journal_id)],
            fields=['id', 'name', 'code', 'type', 'currency_id', 'bank_account_id']
        )
        return journals[0] if journals else None

    def get_all_bank_journals(self) -> List[Dict]:
        """
        Ottiene tutti i giornali bancari

        Returns:
            Lista giornali bancari
        """
        return self.odoo.search_read(
            'account.journal',
            [('type', '=', 'bank')],
            fields=['id', 'name', 'code', 'bank_account_id', 'currency_id'],
            order='name'
        )

    def create_statement_line(self, data: Dict) -> int:
        """
        Crea una riga movimento bancario

        Args:
            data: Dizionario con dati movimento (vedi schema sotto)

        Returns:
            ID riga creata

        Schema data minimo:
        {
            'date': '2025-11-11',  # OBBLIGATORIO
            'journal_id': 9,  # OBBLIGATORIO
            'payment_ref': 'Descrizione movimento',
            'amount': 1000.50,  # Positivo=entrata, Negativo=uscita
            'partner_name': 'Nome cliente/fornitore',
            'account_number': 'CH1234567890',
            'ref': 'Riferimento aggiuntivo'
        }
        """
        # Campi obbligatori
        required_fields = ['date', 'journal_id']
        for field in required_fields:
            if field not in data:
                raise ValueError(f"Campo obbligatorio mancante: {field}")

        return self.odoo.create('account.bank.statement.line', data)

    def get_recent_movements(self, journal_id: int = None, limit: int = 10) -> List[Dict]:
        """
        Ottiene movimenti bancari recenti

        Args:
            journal_id: ID giornale (opzionale, tutti se None)
            limit: Numero massimo risultati

        Returns:
            Lista movimenti
        """
        domain = []
        if journal_id:
            domain.append(('journal_id', '=', journal_id))

        return self.odoo.search_read(
            'account.bank.statement.line',
            domain,
            fields=['date', 'payment_ref', 'partner_id', 'amount', 'journal_id', 'is_reconciled'],
            limit=limit,
            order='date desc, id desc'
        )

    def search_partner(self, name: str) -> Optional[int]:
        """
        Cerca un partner per nome

        Args:
            name: Nome partner da cercare

        Returns:
            ID partner se trovato, None altrimenti
        """
        partners = self.odoo.search_read(
            'res.partner',
            [('name', 'ilike', name)],
            fields=['id', 'name'],
            limit=1
        )
        return partners[0]['id'] if partners else None

    def reconcile_line(self, line_id: int, account_move_line_ids: List[int]) -> bool:
        """
        Riconcilia una riga movimento con fatture/pagamenti

        Args:
            line_id: ID riga movimento bancario
            account_move_line_ids: Lista ID righe contabili da riconciliare

        Returns:
            True se successo
        """
        # TODO: Implementare logica riconciliazione
        # Questo richiede chiamata a metodi specifici di riconciliazione
        pass


# Funzioni di utilità
def format_date_odoo(date_str: str, input_format: str = "%d.%m.%Y") -> str:
    """
    Converte data dal formato UBS al formato Odoo

    Args:
        date_str: Data formato UBS (es. "31.12.2024")
        input_format: Formato input (default UBS)

    Returns:
        Data formato Odoo (YYYY-MM-DD)
    """
    dt = datetime.strptime(date_str, input_format)
    return dt.strftime("%Y-%m-%d")


def format_amount_odoo(amount_str: str) -> float:
    """
    Converte importo dal formato UBS al formato Odoo

    Args:
        amount_str: Importo formato UBS (es. "1'234,56" o "1'234.56")

    Returns:
        Float Python/Odoo
    """
    # Rimuovi apostrofi (separatore migliaia svizzero)
    amount_str = amount_str.replace("'", "").replace(" ", "")

    # Gestisci sia virgola che punto come decimale
    if "," in amount_str:
        amount_str = amount_str.replace(",", ".")

    return float(amount_str)


if __name__ == "__main__":
    # Test connessione
    print("🔌 Test connessione Odoo...\n")

    odoo = OdooConnector()
    if odoo.connect():
        print("\n📊 Test recupero giornali bancari...")
        manager = BankStatementManager(odoo)

        journals = manager.get_all_bank_journals()
        print(f"\n✅ Trovati {len(journals)} giornali bancari:")
        for j in journals:
            print(f"  - [{j['id']}] {j['name']} ({j['code']})")

        print(f"\n📋 Test movimenti recenti (giornale {config.DEFAULT_JOURNAL_NAME})...")
        movements = manager.get_recent_movements(config.DEFAULT_JOURNAL_ID, limit=5)
        print(f"\n✅ Trovati {len(movements)} movimenti:")
        for m in movements:
            partner = m['partner_id'][1] if m['partner_id'] else "N/A"
            reconciled = "✓" if m['is_reconciled'] else "✗"
            print(f"  [{reconciled}] {m['date']} | {partner:30s} | CHF {m['amount']:>10.2f}")
