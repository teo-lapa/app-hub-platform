# Fix Gemini - Aggiungi parametro pagesToRead e modifica prompt

$filePath = "app\api\arrivo-merce\parse-invoice\route.ts"
$content = Get-Content $filePath -Raw

# 1. Aggiungi parametro pagesToRead alla funzione
$content = $content -replace 'const callGeminiAgent = async \(pdfBase64: string, agentName: string\)', 'const callGeminiAgent = async (pdfBase64: string, agentName: string, pagesToRead?: number[])'

# 2. Modifica il prompt per includere istruzione pagine
$oldPrompt = 'IMPORTANTE: Se il PDF contiene più documenti \(fattura, packing list, DDT, ecc\.\), leggi SOLO la FATTURA\. Ignora completamente gli altri documenti\.'
$newPrompt = @'
IMPORTANTE: ${pagesToRead && pagesToRead.length > 0
  ? `Leggi SOLO le pagine ${pagesToRead.join(', ')} che contengono la FATTURA. Ignora completamente le altre pagine.`
  : 'Se il PDF contiene più documenti (fattura, packing list, DDT, ecc.), leggi SOLO la FATTURA. Ignora completamente gli altri documenti.'}
'@

$content = $content -replace [regex]::Escape($oldPrompt), $newPrompt

# 3. Trova la chiamata callGeminiAgent e aggiungi parametro pages
$content = $content -replace "callGeminiAgent\(base64, 'AGENT 1 - Estrazione Prodotti \(PDF ORIGINALE\)'\)", "callGeminiAgent(base64, 'AGENT 1 - Estrazione Prodotti', docInfo.primary_document.pages)"

Set-Content $filePath -Value $content -NoNewline
Write-Host "Fix applicato con successo!"
