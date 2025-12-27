const fetch = require('node-fetch');

const cleanTemplate = `<t t-name="l10n_it_stock_ddt.report_ddt_view_copy_1">
    <t t-call="web.external_layout">
        <t t-set="o" t-value="o.with_context(lang=lang)"/>
        <t t-if="o.move_ids_without_package and o.move_ids_without_package[0].partner_id and o.location_dest_id.usage == 'customer' and o.location_id.usage == 'supplier'">
            <t t-set="delivery_from" t-value="o.partner_id"/>
            <t t-set="delivery_to" t-value="o.move_ids_without_package[0].partner_id"/>
        </t>
        <t t-elif="o.picking_type_id.warehouse_id.partner_id">
            <t t-set="delivery_from" t-value="o.picking_type_id.warehouse_id.partner_id"/>
            <t t-set="delivery_to" t-value="o.partner_id"/>
        </t>
        <t t-else="">
            <t t-set="delivery_from" t-value="o.company_id.partner_id"/>
            <t t-set="delivery_to" t-value="o.partner_id"/>
        </t>
        <div class="page">
            <div class="row">
                <div class="col-6">
                    <span><strong>Indirizzo Magazzino:</strong></span>
                    <div t-esc="delivery_from" t-options="{&quot;widget&quot;: &quot;contact&quot;, &quot;fields&quot;: [&quot;address&quot;, &quot;name&quot;, &quot;phone&quot;], &quot;no_marker&quot;: True, &quot;phone_icons&quot;: True}"/>
                    <p t-if="delivery_from.vat">Pta IVA: <span t-field="delivery_from.vat"/></p>
                </div>
                <div class="col-5 offset-1">
                    <div>
                        <span><strong>Indirizzo Cliente:</strong></span>
                        <div t-esc="delivery_to" t-options="{&quot;widget&quot;: &quot;contact&quot;, &quot;fields&quot;: [&quot;address&quot;, &quot;name&quot;, &quot;phone&quot;, &quot;vat&quot;], &quot;no_marker&quot;: True, &quot;phone_icons&quot;: True}"/>
                    </div>
                </div>
            </div>
            <div class="mt16"/>
            <div class="mt64"/>
            <div>
                <h1>Documento di Trasporto <span t-esc="o.l10n_it_ddt_number"/></h1>
            </div>
            <div class="clearfix"/>
            <div class="mb32"/>
            <div class="row">
                <div class="col-6">
                    <table class="table table-bordered">
                        <tbody>
                            <tr>
                                <td>Ragione trasporto</td>
                                <td><span t-field="o.l10n_it_transport_reason"/></td>
                            </tr>
                            <tr>
                                <td>Metodo di trasporto</td>
                                <td><span t-field="o.l10n_it_transport_method"/></td>
                            </tr>
                            <tr>
                                <td>Termini di Resa</td>
                                <td><span t-field="o.sale_id.incoterm.name"/></td>
                            </tr>
                            <tr>
                                <td>Corriere</td>
                                <td><span t-field="o.carrier_id"/></td>
                            </tr>
                        </tbody>
                    </table>
                    <table class="table table-bordered table-sm">
                        <tbody>
                            <tr t-if="o.driver_id">
                                <td><strong>Autista</strong></td>
                                <td><span t-field="o.driver_id.name"/></td>
                            </tr>
                            <tr t-if="o.vehicle_id">
                                <td><strong>Furgone</strong></td>
                                <td><span t-field="o.vehicle_id.name"/></td>
                            </tr>
                            <tr t-if="o.sale_id.user_id">
                                <td><strong>Venditore</strong></td>
                                <td><span t-esc="o.sale_id.user_id.name"/></td>
                            </tr>
                        </tbody>
                    </table>
                    <div t-if="o.l10n_it_transport_method_details">
                        <b>Dettagli metodo di trasporto</b>
                        <span t-field="o.l10n_it_transport_method_details"/>
                    </div>
                </div>
                <div class="col-5 offset-1">
                    <table class="table table-bordered">
                        <tbody>
                            <tr>
                                <td>Ordine</td>
                                <td><span t-field="o.origin"/></td>
                            </tr>
                            <tr>
                                <td>Numero prelievo</td>
                                <td><span t-field="o.name"/></td>
                            </tr>
                            <tr>
                                <td>Data transporto</td>
                                <td><span t-field="o.date_done"/></td>
                            </tr>
                            <tr>
                                <td>Peso lordo (kg)</td>
                                <td><span t-field="o.shipping_weight"/></td>
                            </tr>
                            <tr>
                                <td>Colli</td>
                                <td><span t-field="o.l10n_it_parcels"/></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="mt64"/>
            <div t-if="o.note"><b>Nota:</b> <span t-field="o.note"/></div>

            <div class="mt64"/>
            <div class="mt64"/>

            <table class="table table-sm" name="document_details">
                <thead>
                    <tr>
                        <th><strong>Prodotto</strong></th>
                        <th style="text-align: right;"><strong>Ordinato</strong></th>
                        <th style="text-align: right;"><strong>Consegnato</strong></th>
                        <th style="text-align: right;"><strong>Valore Totale</strong></th>
                    </tr>
                </thead>
                <tbody>
                    <t t-set="total_value" t-value="0"/>
                    <t t-foreach="o.move_ids" t-as="move">
                        <t t-if="move.quantity">
                            <tr>
                                <td><span t-field="move.product_id"/></td>
                                <td style="text-align: right;">
                                    <t t-if="move.sale_line_id">
                                        <span t-field="move.sale_line_id.product_uom_qty"/>
                                    </t>
                                    <t t-else="">
                                        <span t-field="move.product_uom_qty"/>
                                    </t>
                                    <span t-field="move.product_uom" groups="uom.group_uom"/>
                                </td>
                                <td style="text-align: right;">
                                    <span t-field="move.quantity"/>
                                    <span t-field="move.product_uom" groups="uom.group_uom"/>
                                </td>
                                <td style="text-align: right;">
                                    <t t-if="move.sale_line_id">
                                        <t t-set="lst_price" t-value="move.sale_line_id.price_reduce_taxinc * move.quantity"/>
                                    </t>
                                    <t t-else="">
                                        <t t-set="lst_price" t-value="move.product_id.lst_price * move.product_uom._compute_quantity(move.quantity, move.product_id.uom_id)"/>
                                    </t>
                                    <span t-esc="lst_price" t-options="{&quot;widget&quot;: &quot;monetary&quot;, &quot;display_currency&quot;: o.company_id.currency_id}"/>
                                    <t t-set="total_value" t-value="total_value + lst_price"/>
                                </td>
                            </tr>
                        </t>
                    </t>
                    <tr>
                        <td></td>
                        <td></td>
                        <td style="text-align: right;"><b>Totale:</b></td>
                        <td style="text-align: right;">
                            <span t-esc="total_value" t-options="{&quot;widget&quot;: &quot;monetary&quot;, &quot;display_currency&quot;: o.company_id.currency_id}"/>
                        </td>
                    </tr>
                </tbody>
            </table>
            <div class="mt64"/>
            <div class="mt64"/>
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th><span class="fa fa-pencil mt4"/><div class="ml4 d-inline-block"/><strong>Firma Azienda</strong></th>
                        <th><span class="fa fa-pencil mt4"/><div class="ml4 d-inline-block"/><strong>Firma Corriere</strong></th>
                        <th><span class="fa fa-pencil mt4"/><div class="ml4 d-inline-block"/><strong>Firma Cliente</strong></th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><div class="col"></div></td>
                        <td><div class="col"></div></td>
                        <td>
                            <div class="col">
                                <t t-if="o.signature">
                                    <img t-att-src="image_data_uri(o.signature)" style="max-width: 200px; max-height: 80px;"/>
                                </t>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </t>
</t>`;

async function main() {
  const authRes = await fetch('https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com/web/session/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      params: {
        db: 'lapadevadmin-lapa-v2-main-7268478',
        login: 'paul@lapa.ch',
        password: 'lapa201180'
      }
    })
  });

  const cookie = authRes.headers.get('set-cookie').match(/session_id=([^;]+)/)[1];
  const sessionCookie = 'session_id=' + cookie;

  const updateRes = await fetch('https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com/web/dataset/call_kw', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'ir.ui.view',
        method: 'write',
        args: [[7497], { arch_db: cleanTemplate }],
        kwargs: {}
      },
      id: 1
    })
  });

  const data = await updateRes.json();
  console.log('Risultato:', JSON.stringify(data, null, 2));
}

main().catch(console.error);
