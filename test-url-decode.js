// Test per vedere se searchParams.get() decodifica automaticamente
const url = new URL('http://example.com/test?email=paul%40lapa.ch');
const email = url.searchParams.get('email');
console.log('Email ricevuta:', email);
console.log('È decodificata?', email === 'paul@lapa.ch');
