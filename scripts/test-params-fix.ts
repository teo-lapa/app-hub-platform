/**
 * Test script to verify SQL parameter alignment fix
 *
 * This simulates the parameter building logic to ensure
 * that SQL placeholders ($1, $2, $3) match the params array
 */

function testParamsBuild(salespersonId?: string) {
  const start = new Date('2025-01-01');
  const end = new Date('2025-03-31');

  console.log('\n==========================================');
  console.log(`TEST: salespersonId = ${salespersonId || 'null'}`);
  console.log('==========================================\n');

  // QUERY 1: Total customers
  const params: any[] = [];
  const conditions = ['is_active = true'];
  let paramIndex = 1;

  conditions.push(`last_order_date >= $${paramIndex++}`);
  params.push(start.toISOString());
  conditions.push(`last_order_date <= $${paramIndex++}`);
  params.push(end.toISOString());

  if (salespersonId) {
    conditions.push(`assigned_salesperson_id = $${paramIndex++}`);
    params.push(parseInt(salespersonId));
  }

  const whereClause = conditions.join(' AND ');

  console.log('QUERY 1 - Total customers:');
  console.log('WHERE clause:', whereClause);
  console.log('Params:', params);
  console.log('SQL:', `SELECT COUNT(*) FROM customer_avatars WHERE ${whereClause}`);

  // Verify parameter alignment
  console.log('\nParameter verification:');
  params.forEach((param, index) => {
    console.log(`  $${index + 1} -> ${param}`);
  });

  // QUERY 2: New customers
  console.log('\n---\nQUERY 2 - New customers:');
  const newParams: any[] = [];
  const newConditions = ['is_active = true'];
  let newParamIndex = 1;

  newConditions.push(`first_order_date >= $${newParamIndex++}`);
  newParams.push(start.toISOString());
  newConditions.push(`first_order_date <= $${newParamIndex++}`);
  newParams.push(end.toISOString());

  if (salespersonId) {
    newConditions.push(`assigned_salesperson_id = $${newParamIndex++}`);
    newParams.push(parseInt(salespersonId));
  }

  const newWhereClause = newConditions.join(' AND ');
  console.log('WHERE clause:', newWhereClause);
  console.log('Params:', newParams);

  console.log('\nParameter verification:');
  newParams.forEach((param, index) => {
    console.log(`  $${index + 1} -> ${param}`);
  });

  // QUERY 6: By salesperson
  console.log('\n---\nQUERY 6 - By salesperson:');
  const salesParams: any[] = [];
  const salesConditions = ['is_active = true'];
  let salesParamIndex = 1;

  salesConditions.push(`last_order_date >= $${salesParamIndex++}`);
  salesParams.push(start.toISOString());
  salesConditions.push(`last_order_date <= $${salesParamIndex++}`);
  salesParams.push(end.toISOString());

  if (salespersonId) {
    salesConditions.push(`assigned_salesperson_id = $${salesParamIndex++}`);
    salesParams.push(parseInt(salespersonId));
  }

  salesConditions.push('assigned_salesperson_id IS NOT NULL');

  const salesWhereClause = salesConditions.join(' AND ');
  console.log('WHERE clause:', salesWhereClause);
  console.log('Params:', salesParams);

  console.log('\nParameter verification:');
  salesParams.forEach((param, index) => {
    console.log(`  $${index + 1} -> ${param}`);
  });

  console.log('\n');
}

// Test without salesperson filter
testParamsBuild();

// Test with salesperson filter
testParamsBuild('123');
