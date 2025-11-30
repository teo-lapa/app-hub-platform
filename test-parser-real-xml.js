/**
 * Test parser with REAL Odoo XML response
 */

// Real XML from Odoo search_read
const realOdooXML = `<?xml version='1.0'?>
<methodResponse>
<params>
<param>
<value><array><data>
<value><struct>
<member>
<name>id</name>
<value><int>10218</int></value>
</member>
<member>
<name>name</name>
<value><string>Test Direct XML-RPC</string></value>
</member>
<member>
<name>display_name</name>
<value><string>Test Direct XML-RPC</string></value>
</member>
</struct></value>
</data></array></value>
</param>
</params>
</methodResponse>`;

// Parser code from lib/odoo-xmlrpc.ts (lines 147-191)
function parseXMLRPCResponse(xml) {
  // Extract the value inside <param><value>...</value></param>
  const paramMatch = xml.match(/<param>\s*<value>([\s\S]*)<\/value>\s*<\/param>/);
  if (!paramMatch) {
    throw new Error('Invalid XML-RPC response');
  }

  const valueContent = paramMatch[1];
  console.log('valueContent (first 300 chars):', valueContent.substring(0, 300));

  // Check for array FIRST (before checking for nested types)
  const arrayMatch = valueContent.match(/<array><data>([\s\S]*?)<\/data><\/array>/);
  console.log('arrayMatch found:', !!arrayMatch);

  if (arrayMatch) {
    const items = [];
    const dataContent = arrayMatch[1];
    console.log('dataContent (first 500 chars):', dataContent.substring(0, 500));

    // Match struct values specifically to avoid non-greedy issues with nested <value> tags
    const structValueRegex = /<value><struct>([\s\S]*?)<\/struct><\/value>/g;
    let match;
    let matchCount = 0;

    while ((match = structValueRegex.exec(dataContent)) !== null) {
      matchCount++;
      console.log(`\nStruct match #${matchCount} found!`);
      const structContent = match[1];
      console.log('structContent (first 300 chars):', structContent.substring(0, 300));

      // Parse struct members
      const obj = {};
      const memberRegex = /<member>\s*<name>(.*?)<\/name>\s*<value>([\s\S]*?)<\/value>\s*<\/member>/g;
      let memberMatch;
      let memberCount = 0;

      while ((memberMatch = memberRegex.exec(structContent)) !== null) {
        memberCount++;
        const key = memberMatch[1];
        const valContent = memberMatch[2];
        console.log(`  Member #${memberCount}: ${key} = ${valContent.substring(0, 50)}`);

        const intM = valContent.match(/<int>(\d+)<\/int>/);
        const strM = valContent.match(/<string>(.*?)<\/string>/);
        const boolM = valContent.match(/<boolean>([01])<\/boolean>/);

        if (intM) obj[key] = parseInt(intM[1], 10);
        else if (strM) obj[key] = strM[1];
        else if (boolM) obj[key] = boolM[1] === '1';
        else obj[key] = null;
      }

      console.log('  Parsed object:', obj);
      items.push(obj);
    }

    console.log(`\nTotal structs found: ${matchCount}`);
    console.log('Final result:', items);
    return items;
  }

  return null;
}

console.log('=== Testing Parser with Real Odoo XML ===\n');

try {
  const result = parseXMLRPCResponse(realOdooXML);
  console.log('\n=== RESULT ===');
  console.log('Type:', typeof result);
  console.log('Is Array:', Array.isArray(result));
  console.log('Length:', result?.length);
  console.log('Items:', JSON.stringify(result, null, 2));

  if (result && result.length > 0 && result[0].id === 10218) {
    console.log('\n✅ SUCCESS! Parser works correctly!');
  } else {
    console.log('\n❌ FAIL! Parser did not work correctly');
  }
} catch (error) {
  console.error('\n❌ ERROR:', error.message);
}
