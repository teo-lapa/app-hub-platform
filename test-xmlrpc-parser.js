/**
 * Test our XML-RPC parser with actual Odoo responses
 */

// Sample search_read XML response from Odoo
const searchReadXML = `<?xml version='1.0'?>
<methodResponse>
<params>
<param>
<value><array><data>
<value><struct>
<member>
<name>id</name>
<value><int>10215</int></value>
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
</methodResponse>
`;

function parseXMLRPCResponse(xml) {
  // Simple parser for methodResponse
  // Extract the value inside <param><value>...</value></param>
  const paramMatch = xml.match(/<param>\s*<value>([\s\S]*)<\/value>\s*<\/param>/);
  if (!paramMatch) {
    console.error('No param match found!');
    throw new Error('Invalid XML-RPC response');
  }

  console.log('Matched content (first 500 chars):', paramMatch[1].substring(0, 500));
  const valueContent = paramMatch[1];

  // Check for array FIRST (before checking for nested types)
  const arrayMatch = valueContent.match(/<array><data>([\s\S]*?)<\/data><\/array>/);
  if (arrayMatch) {
    const items = [];
    const dataContent = arrayMatch[1];
    const valueRegex = /<value>([\s\S]*?)<\/value>/g;
    let match;

    while ((match = valueRegex.exec(dataContent)) !== null) {
      const itemContent = match[1];
      console.log('Item content (first 200 chars):', itemContent.substring(0, 200));

      // Parse struct
      const structMatch = itemContent.match(/<struct>([\s\S]*?)<\/struct>/);
      console.log('Struct match:', !!structMatch);
      if (structMatch) {
        const obj = {};
        const memberRegex = /<member><name>(.*?)<\/name><value>([\s\S]*?)<\/value><\/member>/g;
        let memberMatch;

        while ((memberMatch = memberRegex.exec(structMatch[1])) !== null) {
          const key = memberMatch[1];
          const valContent = memberMatch[2];

          const intM = valContent.match(/<int>(\d+)<\/int>/);
          const strM = valContent.match(/<string>(.*?)<\/string>/);
          const boolM = valContent.match(/<boolean>([01])<\/boolean>/);

          if (intM) obj[key] = parseInt(intM[1], 10);
          else if (strM) obj[key] = strM[1];
          else if (boolM) obj[key] = boolM[1] === '1';
          else obj[key] = null;
        }

        items.push(obj);
      }
    }

    return items;
  }

  // Check for int
  const intMatch = valueContent.match(/<int>(\d+)<\/int>/);
  if (intMatch) {
    return parseInt(intMatch[1], 10);
  }

  // Check for boolean
  const boolMatch = valueContent.match(/<boolean>([01])<\/boolean>/);
  if (boolMatch) {
    return boolMatch[1] === '1';
  }

  // Check for string
  const strMatch = valueContent.match(/<string>(.*?)<\/string>/);
  if (strMatch) {
    return strMatch[1];
  }

  return null;
}

console.log('=== Testing XML-RPC Parser ===\n');

console.log('Parsing search_read response...');
const result = parseXMLRPCResponse(searchReadXML);

console.log('Result:', result);
console.log('Type:', typeof result);
console.log('Is Array:', Array.isArray(result));
console.log('Length:', result?.length);
console.log('First item:', result?.[0]);
console.log('First item type:', typeof result?.[0]);
console.log('First item ID:', result?.[0]?.id);
